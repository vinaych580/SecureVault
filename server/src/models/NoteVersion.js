const mongoose = require('mongoose');

const noteVersionSchema = new mongoose.Schema({
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true },
  title: { type: Object, required: true },   // encrypted snapshot
  content: { type: Object, required: true }, // encrypted snapshot
  sizeBytes: { type: Number, default: 0 },
  savedAt: { type: Date, default: Date.now },
});

noteVersionSchema.index({ noteId: 1, version: -1 });

module.exports = mongoose.model('NoteVersion', noteVersionSchema);
