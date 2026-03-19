const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const RefreshToken = require('../models/RefreshToken');
const { generateRandomHex, hashToken } = require('../utils/crypto');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../services/tokenService');
const { sendVerificationEmail, sendPasswordResetEmail, sendLoginAlertEmail } = require('../services/emailService');
const { encrypt, decrypt } = require('../services/encryptionService');
const { generateFingerprint } = require('../middleware/sessionFingerprint');
const { generateSecret, generateURI, verifyToken } = require('../services/totpService');
const { JWT_ACCESS_SECRET } = require('../config/env');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ─── REGISTER ───
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return ApiResponse.error(res, 409, 'EMAIL_EXISTS', 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const pbkdf2Salt = generateRandomHex(32);

  const emailVerifyToken = generateRandomHex(32);
  const emailVerifyTokenHash = hashToken(emailVerifyToken);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    pbkdf2Salt,
    emailVerifyToken: emailVerifyTokenHash,
    emailVerifyExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(email, emailVerifyToken);
  await AuditLog.logEvent(user._id, 'REGISTER', req);

  ApiResponse.created(res, { userId: user._id }, 'Registration successful. Please check your email to verify.');
});

// ─── VERIFY EMAIL ───
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) return ApiResponse.error(res, 400, 'MISSING_TOKEN', 'Verification token required');

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    emailVerifyToken: tokenHash,
    emailVerifyExpiry: { $gt: Date.now() },
  });

  if (!user) return ApiResponse.error(res, 400, 'INVALID_TOKEN', 'Invalid or expired verification link');

  user.isEmailVerified = true;
  user.emailVerifyToken = null;
  user.emailVerifyExpiry = null;
  await user.save();

  ApiResponse.success(res, null, 'Email verified successfully');
});

// ─── LOGIN ───
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return ApiResponse.error(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  if (!user.isEmailVerified) {
    return ApiResponse.error(res, 403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in');
  }

  // Account lockout check
  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    return ApiResponse.error(res, 423, 'ACCOUNT_LOCKED', `Account locked. Try again in ${minutesLeft} minutes.`);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 10) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    await user.save();
    return ApiResponse.error(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // 2FA check
  if (user.twoFAEnabled) {
    const tempToken = jwt.sign({ userId: user._id, type: '2fa-pending' }, JWT_ACCESS_SECRET, { expiresIn: '5m' });
    return ApiResponse.success(res, { requires2FA: true, tempToken });
  }

  // Complete login
  return completeLogin(user, req, res);
});

// ─── Complete login (shared by login and 2FA verify) ───
const completeLogin = async (user, req, res) => {
  user.loginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  user.lastLoginDevice = req.get('user-agent');
  await user.save();

  const sessionId = generateRandomHex(16);
  const fingerprint = generateFingerprint(req);
  const accessToken = generateAccessToken(user._id, sessionId, fingerprint);
  const refreshToken = generateRefreshToken();
  await saveRefreshToken(user._id, refreshToken, sessionId, req);

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await AuditLog.logEvent(user._id, 'LOGIN', req);

  // Alert email if enabled
  if (user.settings.loginEmailAlert) {
    sendLoginAlertEmail(user.email, req.get('user-agent'), req.ip).catch(() => {});
  }

  ApiResponse.success(res, {
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      settings: user.settings,
      pbkdf2Salt: user.pbkdf2Salt,
      twoFAEnabled: user.twoFAEnabled,
      googleConnected: user.googleConnected,
      storageUsed: user.storageUsed,
    },
  }, 'Login successful');
};

// ─── LOGOUT ───
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await RefreshToken.deleteOne({ tokenHash });
  }
  res.clearCookie('refreshToken');
  if (req.user) await AuditLog.logEvent(req.user.id, 'LOGOUT', req);
  ApiResponse.success(res, null, 'Logged out');
});

// ─── REFRESH TOKEN ───
const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies.refreshToken;
  if (!rawToken) return ApiResponse.error(res, 401, 'NO_TOKEN', 'No refresh token');

  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) return ApiResponse.error(res, 401, 'INVALID_TOKEN', 'Invalid refresh token');

  if (stored.isRotated) {
    // Token reuse detected — revoke ALL for this user
    await RefreshToken.deleteMany({ userId: stored.userId });
    res.clearCookie('refreshToken');
    return ApiResponse.error(res, 401, 'TOKEN_REUSE', 'Session compromised. All sessions revoked.');
  }

  if (stored.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: stored._id });
    res.clearCookie('refreshToken');
    return ApiResponse.error(res, 401, 'TOKEN_EXPIRED', 'Refresh token expired');
  }

  // Rotate: mark old as rotated, issue new
  stored.isRotated = true;
  await stored.save();

  const user = await User.findById(stored.userId);
  if (!user) return ApiResponse.error(res, 401, 'USER_NOT_FOUND', 'User not found');

  const newRefreshToken = generateRefreshToken();
  await saveRefreshToken(user._id, newRefreshToken, stored.sessionId, req);

  const fingerprint = generateFingerprint(req);
  const accessToken = generateAccessToken(user._id, stored.sessionId, fingerprint);

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ApiResponse.success(res, { accessToken });
});

// ─── FORGOT PASSWORD ───
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Always return success (prevent email enumeration)
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const resetToken = generateRandomHex(32);
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendPasswordResetEmail(email, resetToken);
  }
  ApiResponse.success(res, null, 'If that email is registered, a reset link has been sent');
});

// ─── RESET PASSWORD ───
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpiry: { $gt: Date.now() },
  });
  if (!user) return ApiResponse.error(res, 400, 'INVALID_TOKEN', 'Invalid or expired reset token');

  user.passwordHash = await bcrypt.hash(password, 12);
  user.pbkdf2Salt = generateRandomHex(32);
  user.passwordResetToken = null;
  user.passwordResetExpiry = null;
  await user.save();

  // Invalidate all refresh tokens
  await RefreshToken.deleteMany({ userId: user._id });
  await AuditLog.logEvent(user._id, 'PASSWORD_RESET', req);

  ApiResponse.success(res, { pbkdf2Salt: user.pbkdf2Salt }, 'Password reset successful');
});

// ─── RESEND VERIFICATION ───
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase(), isEmailVerified: false });
  if (!user) return ApiResponse.success(res, null, 'If applicable, verification email sent');

  const emailVerifyToken = generateRandomHex(32);
  user.emailVerifyToken = hashToken(emailVerifyToken);
  user.emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  await sendVerificationEmail(email, emailVerifyToken);
  ApiResponse.success(res, null, 'Verification email sent');
});

// ─── 2FA SETUP ───
const setup2FA = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');

  const secret = generateSecret();

  // Store encrypted
  user.twoFASecret = encrypt(secret);
  await user.save();

  const otpauthUrl = generateURI({ issuer: 'SecureVault', label: user.email, secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  ApiResponse.success(res, { qrCode: qrCodeUrl, secret });
});

// ─── 2FA VERIFY SETUP ───
const verifySetup2FA = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');
  if (!user.twoFASecret) return ApiResponse.error(res, 400, 'TWO_FA_NOT_SETUP', '2FA setup has not been started');
  const secret = decrypt(user.twoFASecret);

  if (!verifyToken({ token: code, secret })) {
    return ApiResponse.error(res, 400, 'INVALID_CODE', '2FA code is invalid');
  }

  // Generate backup codes
  const backupCodes = [];
  const hashedCodes = [];
  for (let i = 0; i < 10; i++) {
    const code = generateRandomHex(4).toUpperCase();
    backupCodes.push(code);
    hashedCodes.push(await bcrypt.hash(code, 10));
  }
  user.twoFAEnabled = true;
  user.twoFABackupCodes = hashedCodes;
  await user.save();
  await AuditLog.logEvent(user._id, 'TWO_FA_ENABLED', req);

  ApiResponse.success(res, { backupCodes }, '2FA enabled');
});

// ─── 2FA VERIFY LOGIN ───
const verify2FA = asyncHandler(async (req, res) => {
  const { code, tempToken } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(tempToken, JWT_ACCESS_SECRET);
  } catch {
    return ApiResponse.error(res, 401, 'INVALID_TOKEN', 'Temporary token invalid or expired');
  }
  if (decoded.type !== '2fa-pending') {
    return ApiResponse.error(res, 401, 'INVALID_TOKEN', 'Not a 2FA token');
  }

  const user = await User.findById(decoded.userId);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');
  if (!user.twoFASecret) return ApiResponse.error(res, 400, 'TWO_FA_NOT_SETUP', '2FA has not been configured');

  const secret = decrypt(user.twoFASecret);

  // Try TOTP first
  if (verifyToken({ token: code, secret })) {
    return completeLogin(user, req, res);
  }

  // Try backup codes
  for (let i = 0; i < user.twoFABackupCodes.length; i++) {
    if (await bcrypt.compare(code, user.twoFABackupCodes[i])) {
      user.twoFABackupCodes.splice(i, 1); // Invalidate used code
      await user.save();
      return completeLogin(user, req, res);
    }
  }

  return ApiResponse.error(res, 401, 'INVALID_CODE', 'Invalid 2FA code');
});

// ─── DISABLE 2FA ───
const disable2FA = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return ApiResponse.error(res, 401, 'INVALID_PASSWORD', 'Incorrect password');

  user.twoFAEnabled = false;
  user.twoFASecret = null;
  user.twoFABackupCodes = [];
  await user.save();
  await AuditLog.logEvent(user._id, 'TWO_FA_DISABLED', req);
  ApiResponse.success(res, null, '2FA disabled');
});

// ─── GET SESSIONS ───
const getSessions = asyncHandler(async (req, res) => {
  const sessions = await RefreshToken.find({ userId: req.user.id, isRotated: false })
    .select('sessionId deviceName browser ipAddress lastUsedAt createdAt')
    .sort({ lastUsedAt: -1 });
  ApiResponse.success(res, sessions);
});

// ─── REVOKE SESSION ───
const revokeSession = asyncHandler(async (req, res) => {
  await RefreshToken.deleteOne({ sessionId: req.params.sessionId, userId: req.user.id });
  await AuditLog.logEvent(req.user.id, 'SESSION_REVOKED', req, { sessionId: req.params.sessionId });
  ApiResponse.success(res, null, 'Session revoked');
});

// ─── REVOKE ALL SESSIONS ───
const revokeAllSessions = asyncHandler(async (req, res) => {
  const currentToken = req.cookies.refreshToken;
  const currentHash = currentToken ? hashToken(currentToken) : null;
  await RefreshToken.deleteMany({
    userId: req.user.id,
    ...(currentHash ? { tokenHash: { $ne: currentHash } } : {}),
  });
  ApiResponse.success(res, null, 'All other sessions revoked');
});

module.exports = {
  register, verifyEmail, login, logout, refresh,
  forgotPassword, resetPassword, resendVerification,
  setup2FA, verifySetup2FA, verify2FA, disable2FA,
  getSessions, revokeSession, revokeAllSessions,
};
