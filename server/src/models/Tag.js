const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: Object, required: true }, // { iv, data } encrypted
  color: { type: String, default: null },
}, { timestamps: true });

tagSchema.index({ userId: 1 });

module.exports = mongoose.model('Tag', tagSchema);
