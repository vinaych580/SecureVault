const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  deviceName: { type: String, default: 'Unknown Device' },
  browser: { type: String, default: null },
  ipAddress: { type: String, default: null },
  isRotated: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
