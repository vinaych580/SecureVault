const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = require('../config/env');
const { generateRandomHex, hashToken } = require('../utils/crypto');
const RefreshToken = require('../models/RefreshToken');

const generateAccessToken = (userId, sessionId, fingerprint) => {
  return jwt.sign(
    { userId, sessionId, fingerprint },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = () => {
  return generateRandomHex(32);
};

const saveRefreshToken = async (userId, rawToken, sessionId, req) => {
  const tokenHash = hashToken(rawToken);
  const ua = req.get('user-agent') || 'Unknown';
  await RefreshToken.create({
    userId,
    tokenHash,
    sessionId,
    deviceName: parseDevice(ua),
    browser: parseBrowser(ua),
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
  return tokenHash;
};

// Simple user-agent parsing helpers
const parseDevice = (ua) => {
  if (/mobile/i.test(ua)) return 'Mobile';
  if (/tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
};

const parseBrowser = (ua) => {
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/edg/i.test(ua)) return 'Edge';
  return 'Unknown';
};

module.exports = {
  generateAccessToken, generateRefreshToken, saveRefreshToken,
  hashToken,
};
