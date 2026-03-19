const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');

const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return ApiResponse.error(
      res,
      503,
      'DATABASE_UNAVAILABLE',
      'Database is unavailable. Try again when the server reconnects.'
    );
  }

  next();
};

module.exports = requireDatabase;
