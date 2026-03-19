const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = require('../config/env');
const ApiResponse = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return ApiResponse.error(res, 401, 'NO_TOKEN', 'Not authorized, no token provided');
  }
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    if (decoded.fingerprint && req.fingerprint && decoded.fingerprint !== req.fingerprint) {
      return ApiResponse.error(res, 401, 'SESSION_MISMATCH', 'Session fingerprint mismatch');
    }
    req.user = { id: decoded.userId, sessionId: decoded.sessionId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    return ApiResponse.error(res, 401, 'INVALID_TOKEN', 'Not authorized, token invalid');
  }
};

module.exports = { protect };
