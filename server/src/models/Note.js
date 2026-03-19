const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: Object, required: true },    // { iv, data } encrypted
  content: { type: Object, required: true },  // { iv, data } encrypted TipTap JSON
  preview: { type: Object, default: null },   // { iv, data } encrypted first 100 chars
  tags: [{ type: Object }],                   // Array of { iv, data } encrypted

  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  color: { type: String, default: null },

  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isTrashed: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },

  encryptionVersion: { type: String, default: 'v1-aes256gcm' },
  checksum: { type: String, default: null },
  version: { type: Number, default: 1 },
  syncStatus: { type: String, enum: ['local', 'synced', 'pending', 'conflict'], default: 'synced' },

  driveFileId: { type: String, default: null },
  lastSyncedAt: { type: Date, default: null },
  trashedAt: { type: Date, default: null },
  lastEditedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound indexes for efficient queries
noteSchema.index({ userId: 1, isTrashed: 1, isArchived: 1 });
noteSchema.index({ userId: 1, folderId: 1 });
noteSchema.index({ userId: 1, isStarred: 1 });
noteSchema.index({ userId: 1, isPinned: 1, lastEditedAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
