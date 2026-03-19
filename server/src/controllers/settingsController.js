const bcrypt = require('bcrypt');
const User = require('../models/User');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const AuditLog = require('../models/AuditLog');
const RefreshToken = require('../models/RefreshToken');
const Folder = require('../models/Folder');
const Tag = require('../models/Tag');
const ShareLink = require('../models/ShareLink');
const SyncLog = require('../models/SyncLog');
const { generateRandomHex } = require('../utils/crypto');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const ALLOWED_SETTINGS_KEYS = new Set([
  'autoSyncEnabled',
  'syncInterval',
  'defaultNoteColor',
  'theme',
  'fontSize',
  'editorWidth',
  'autoLockTimeout',
  'exportFormat',
  'includeMetadataExport',
  'loginEmailAlert',
  'clipboardClearDelay',
  'notePinLockEnabled',
  'notePinHash',
]);

const getSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('settings name email storageUsed');
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');
  ApiResponse.success(res, user);
});

const updateSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');

  for (const [key, value] of Object.entries(req.body || {})) {
    if (ALLOWED_SETTINGS_KEYS.has(key)) {
      user.settings[key] = value;
    }
  }

  await user.save();
  ApiResponse.success(res, user.settings);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) return ApiResponse.error(res, 401, 'INVALID_PASSWORD', 'Current password incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.pbkdf2Salt = generateRandomHex(32); // New salt for key rotation
  await user.save();
  await RefreshToken.deleteMany({ userId: user._id });
  res.clearCookie('refreshToken');
  await AuditLog.logEvent(user._id, 'PASSWORD_CHANGE', req);
  ApiResponse.success(res, { pbkdf2Salt: user.pbkdf2Salt }, 'Password changed. Re-encryption required.');
});

const getAuditLog = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find({ userId: req.user.id })
    .sort({ timestamp: -1 })
    .limit(20);
  ApiResponse.success(res, logs);
});

const deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmation } = req.body;
  if (confirmation !== 'DELETE MY ACCOUNT') {
    return ApiResponse.error(res, 400, 'INVALID_CONFIRMATION', 'Type "DELETE MY ACCOUNT" to confirm');
  }
  const user = await User.findById(req.user.id);
  if (!user) return ApiResponse.error(res, 404, 'USER_NOT_FOUND', 'User not found');
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return ApiResponse.error(res, 401, 'INVALID_PASSWORD', 'Incorrect password');

  await Note.deleteMany({ userId: user._id });
  await NoteVersion.deleteMany({ userId: user._id });
  await Folder.deleteMany({ userId: user._id });
  await Tag.deleteMany({ userId: user._id });
  await ShareLink.deleteMany({ userId: user._id });
  await SyncLog.deleteMany({ userId: user._id });
  await RefreshToken.deleteMany({ userId: user._id });
  await AuditLog.logEvent(user._id, 'ACCOUNT_DELETED', req);
  await User.deleteOne({ _id: user._id });

  res.clearCookie('refreshToken');
  ApiResponse.success(res, null, 'Account permanently deleted');
});

module.exports = { getSettings, updateSettings, changePassword, getAuditLog, deleteAccount };
