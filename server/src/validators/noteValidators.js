const { body, param } = require('express-validator');

const createNoteValidator = [
  body('title').exists().withMessage('Title is required'),
  body('content').exists().withMessage('Content is required'),
];

const updateNoteValidator = [
  param('id').isMongoId().withMessage('Invalid note ID'),
];

const noteIdValidator = [
  param('id').isMongoId().withMessage('Invalid note ID'),
];

const bulkIdsValidator = [
  body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
];

module.exports = { createNoteValidator, updateNoteValidator, noteIdValidator, bulkIdsValidator };
