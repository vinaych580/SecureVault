const express = require('express');
const router = express.Router();
const notes = require('../controllers/notesController');
const { protect } = require('../middleware/authMiddleware');
const { notesCrudLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');
const { createNoteValidator, updateNoteValidator, noteIdValidator, bulkIdsValidator } = require('../validators/noteValidators');

router.use(protect);
router.use(notesCrudLimiter);

router.get('/', notes.getNotes);
router.post('/', createNoteValidator, validateRequest, notes.createNote);
router.get('/:id', noteIdValidator, validateRequest, notes.getNote);
router.put('/:id', updateNoteValidator, validateRequest, notes.updateNote);
router.delete('/:id', noteIdValidator, validateRequest, notes.deleteNote);

router.post('/:id/restore', noteIdValidator, validateRequest, notes.restoreNote);
router.delete('/:id/permanent', noteIdValidator, validateRequest, notes.permanentDelete);
router.post('/:id/duplicate', noteIdValidator, validateRequest, notes.duplicateNote);

router.put('/:id/pin', noteIdValidator, validateRequest, notes.togglePin);
router.put('/:id/star', noteIdValidator, validateRequest, notes.toggleStar);
router.put('/:id/archive', noteIdValidator, validateRequest, notes.toggleArchive);
router.put('/:id/lock', noteIdValidator, validateRequest, notes.toggleLock);
router.put('/:id/color', noteIdValidator, validateRequest, notes.updateColor);
router.put('/:id/move', noteIdValidator, validateRequest, notes.moveNote);

router.get('/:id/versions', noteIdValidator, validateRequest, notes.getVersions);
router.get('/:id/versions/:version', notes.getVersion);
router.post('/:id/versions/:version/restore', notes.restoreVersion);

router.post('/bulk-delete', bulkIdsValidator, validateRequest, notes.bulkDelete);
router.post('/bulk-move', bulkIdsValidator, validateRequest, notes.bulkMove);
router.post('/empty-trash', notes.emptyTrash);

module.exports = router;
