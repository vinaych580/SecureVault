const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  autoSyncEnabled: { type: Boolean, default: false },
  syncInterval: { type: Number, default: 15 },
  defaultNoteColor: { type: String, default: null },
  theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
  fontSize: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
  editorWidth: { type: String, enum: ['narrow', 'medium', 'wide'], default: 'medium' },
  autoLockTimeout: { type: Number, default: 30 },
  exportFormat: { type: String, default: 'pdf' },
  includeMetadataExport: { type: Boolean, default: true },
  loginEmailAlert: { type: Boolean, default: false },
  clipboardClearDelay: { type: Number, default: 60 },
  notePinLockEnabled: { type: Boolean, default: false },
  notePinHash: { type: String, default: null },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  pbkdf2Salt: { type: String, required: true },

  isEmailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String, default: null },
  emailVerifyExpiry: { type: Date, default: null },

  passwordResetToken: { type: String, default: null },
  passwordResetExpiry: { type: Date, default: null },

  twoFASecret: { type: Object, default: null }, // server-encrypted
  twoFAEnabled: { type: Boolean, default: false },
  twoFABackupCodes: [{ type: String }], // bcrypt-hashed

  googleConnected: { type: Boolean, default: false },
  googleAccessToken: { type: Object, default: null }, // server-encrypted
  googleRefreshToken: { type: Object, default: null }, // server-encrypted
  googleEmail: { type: String, default: null },
  googleTokenExpiry: { type: Date, default: null },

  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: null },
  lastLoginDevice: { type: String, default: null },

  storageUsed: { type: Number, default: 0 },
  settings: { type: settingsSchema, default: () => ({}) },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
