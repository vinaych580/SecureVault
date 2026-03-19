const mongoose = require('mongoose');

const shareLinkSchema = new mongoose.Schema({
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  encryptedContent: { type: Object, required: true },
  isPasswordProtected: { type: Boolean, default: false },
  passwordHash: { type: String, default: null },
  viewCount: { type: Number, default: 0 },
  maxViews: { type: Number, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
