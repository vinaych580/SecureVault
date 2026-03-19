const crypto = require('crypto');
const { SESSION_FINGERPRINT_SECRET } = require('../config/env');

const generateFingerprint = (req) => {
  const ua = req.get('user-agent') || '';
  return crypto.createHmac('sha256', SESSION_FINGERPRINT_SECRET).update(ua).digest('hex');
};

const sessionFingerprint = (req, res, next) => {
  req.fingerprint = generateFingerprint(req);
  next();
};

module.exports = { sessionFingerprint, generateFingerprint };
