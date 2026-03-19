const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  operation: { type: String, enum: ['PUSH', 'PULL', 'FULL_SYNC', 'CONFLICT_RESOLVED'], required: true },
  status: { type: String, enum: ['SUCCESS', 'PARTIAL', 'FAILED'], required: true },
  notesAffected: { type: Number, default: 0 },
  conflictsFound: { type: Number, default: 0 },
  conflictsResolved: { type: Number, default: 0 },
  errorMessage: { type: String, default: null },
  duration: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

module.exports = mongoose.model('SyncLog', syncLogSchema);
