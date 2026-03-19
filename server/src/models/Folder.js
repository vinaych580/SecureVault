const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: Object, required: true }, // { iv, data } encrypted
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  color: { type: String, default: null },
  order: { type: Number, default: 0 },
}, { timestamps: true });

folderSchema.index({ userId: 1, parentId: 1 });

module.exports = mongoose.model('Folder', folderSchema);
