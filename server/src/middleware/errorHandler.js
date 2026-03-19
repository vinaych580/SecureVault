const ApiResponse = require('../utils/apiResponse');

const notFoundHandler = (req, res) => {
  ApiResponse.error(res, 404, 'NOT_FOUND', `Route ${req.originalUrl} not found`);
};

const errorHandler = (err, req, res, _next) => {
  console.error('ERROR:', err.message);
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    return ApiResponse.error(res, 400, 'VALIDATION_ERROR', err.message);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return ApiResponse.error(res, 409, 'DUPLICATE', `${field || 'Field'} already exists`);
  }
  if (err.name === 'CastError') {
    return ApiResponse.error(res, 400, 'INVALID_ID', 'Invalid resource ID');
  }

  const statusCode = err.statusCode || 500;
  ApiResponse.error(res, statusCode, 'SERVER_ERROR', err.message || 'Internal server error');
};

module.exports = { errorHandler, notFoundHandler };
