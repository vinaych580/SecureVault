const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ApiResponse.error(res, 400, 'VALIDATION_ERROR', 'Invalid input', errors.array());
  }
  next();
};

module.exports = validateRequest;
