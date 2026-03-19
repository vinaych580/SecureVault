const { body } = require('express-validator');

const registerValidator = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a symbol'),
  body('confirmPassword').custom((val, { req }) => val === req.body.password).withMessage('Passwords must match'),
];

const loginValidator = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
];

const forgotPasswordValidator = [body('email').isEmail().normalizeEmail()];

const resetPasswordValidator = [
  body('token').notEmpty(),
  body('password').isLength({ min: 8, max: 128 })
    .matches(/[A-Z]/).matches(/[0-9]/).matches(/[^A-Za-z0-9]/),
];

const twoFACodeValidator = [body('code').isLength({ min: 6, max: 8 }).withMessage('Valid code required')];

module.exports = {
  registerValidator, loginValidator, forgotPasswordValidator,
  resetPasswordValidator, twoFACodeValidator,
};
