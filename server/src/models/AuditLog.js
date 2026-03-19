const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: {
    type: String,
    required: true,
    enum: [
      'LOGIN', 'LOGOUT', 'REGISTER', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
      'TWO_FA_ENABLED', 'TWO_FA_DISABLED', 'NOTE_EXPORT', 'SHARE_LINK_CREATED',
      'SHARE_LINK_REVOKED', 'GOOGLE_CONNECTED', 'GOOGLE_DISCONNECTED',
      'ACCOUNT_DELETED', 'SESSION_REVOKED',
    ],
  },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  metadata: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now },
});

// Static: keep last 100 per user, prune older on write
auditLogSchema.statics.logEvent = async function (userId, event, req, metadata = {}) {
  await this.create({
    userId, event,
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    metadata,
  });
  // Prune old entries beyond 100
  const count = await this.countDocuments({ userId });
  if (count > 100) {
    const oldest = await this.find({ userId }).sort({ timestamp: 1 }).limit(count - 100).select('_id');
    await this.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
