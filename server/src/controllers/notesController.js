const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ─── LIST NOTES ───
const getNotes = asyncHandler(async (req, res) => {
  const { folderId, starred, archived, trashed, page = 1, limit = 50, sortBy = 'lastEditedAt', sortOrder = 'desc' } = req.query;
  const filter = { userId: req.user.id };

  if (folderId) filter.folderId = folderId;
  if (starred === 'true') filter.isStarred = true;
  if (archived === 'true') { filter.isArchived = true; } else { filter.isArchived = false; }
  if (trashed === 'true') { filter.isTrashed = true; } else { filter.isTrashed = false; }

  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [items, total] = await Promise.all([
    Note.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
    Note.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, items, total, parseInt(page), parseInt(limit));
});

// ─── GET SINGLE NOTE ───
const getNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  ApiResponse.success(res, note);
});

// ─── CREATE NOTE ───
const createNote = asyncHandler(async (req, res) => {
  const { title, content, preview, tags, folderId, color } = req.body;
  const note = await Note.create({
    userId: req.user.id,
    title, content, preview, tags,
    folderId: folderId || null,
    color: color || null,
  });
  ApiResponse.created(res, note);
});

// ─── UPDATE NOTE ───
const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');

  const { title, content, preview, tags, checksum } = req.body;

  // Save version snapshot before overwriting (if content changed)
  if (content && note.checksum !== checksum) {
    const versionCount = await NoteVersion.countDocuments({ noteId: note._id });
    if (versionCount >= 10) {
      const oldest = await NoteVersion.findOne({ noteId: note._id }).sort({ version: 1 });
      if (oldest) await oldest.deleteOne();
    }
    await NoteVersion.create({
      noteId: note._id,
      userId: req.user.id,
      version: note.version,
      title: note.title,
      content: note.content,
      sizeBytes: JSON.stringify(note.content).length,
    });
  }

  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  if (preview !== undefined) note.preview = preview;
  if (tags !== undefined) note.tags = tags;
  if (checksum !== undefined) note.checksum = checksum;
  note.version += 1;
  note.lastEditedAt = new Date();
  await note.save();

  ApiResponse.success(res, note);
});

// ─── SOFT DELETE (to trash) ───
const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { isTrashed: true, trashedAt: new Date() },
    { new: true }
  );
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  ApiResponse.success(res, note, 'Moved to trash');
});

// ─── RESTORE FROM TRASH ───
const restoreNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, isTrashed: true },
    { isTrashed: false, trashedAt: null },
    { new: true }
  );
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  ApiResponse.success(res, note, 'Restored');
});

// ─── PERMANENT DELETE ───
const permanentDelete = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id, isTrashed: true });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found or not in trash');
  await NoteVersion.deleteMany({ noteId: note._id });
  ApiResponse.success(res, null, 'Permanently deleted');
});

// ─── DUPLICATE ───
const duplicateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  const dup = await Note.create({
    userId: req.user.id,
    title: note.title, content: note.content, preview: note.preview,
    tags: note.tags, folderId: note.folderId, color: note.color,
  });
  ApiResponse.created(res, dup, 'Duplicated');
});

// ─── TOGGLE FLAGS ───
const togglePin = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  note.isPinned = !note.isPinned;
  await note.save();
  ApiResponse.success(res, note);
});

const toggleStar = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  note.isStarred = !note.isStarred;
  await note.save();
  ApiResponse.success(res, note);
});

const toggleArchive = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  note.isArchived = !note.isArchived;
  await note.save();
  ApiResponse.success(res, note);
});

const toggleLock = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  note.isLocked = !note.isLocked;
  await note.save();
  ApiResponse.success(res, note);
});

const updateColor = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { color: req.body.color },
    { new: true }
  );
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  ApiResponse.success(res, note);
});

const moveNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { folderId: req.body.folderId || null },
    { new: true }
  );
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');
  ApiResponse.success(res, note);
});

// ─── BULK OPS ───
const bulkDelete = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  await Note.updateMany(
    { _id: { $in: ids }, userId: req.user.id },
    { isTrashed: true, trashedAt: new Date() }
  );
  ApiResponse.success(res, null, 'Notes moved to trash');
});

const bulkMove = asyncHandler(async (req, res) => {
  const { ids, folderId } = req.body;
  await Note.updateMany(
    { _id: { $in: ids }, userId: req.user.id },
    { folderId: folderId || null }
  );
  ApiResponse.success(res, null, 'Notes moved');
});

const emptyTrash = asyncHandler(async (req, res) => {
  const trashed = await Note.find({ userId: req.user.id, isTrashed: true }).select('_id');
  const ids = trashed.map(n => n._id);
  await Note.deleteMany({ _id: { $in: ids } });
  await NoteVersion.deleteMany({ noteId: { $in: ids } });
  ApiResponse.success(res, null, 'Trash emptied');
});

// ─── VERSION HISTORY ───
const getVersions = asyncHandler(async (req, res) => {
  const versions = await NoteVersion.find({ noteId: req.params.id, userId: req.user.id })
    .select('version savedAt sizeBytes')
    .sort({ version: -1 });
  ApiResponse.success(res, versions);
});

const getVersion = asyncHandler(async (req, res) => {
  const version = await NoteVersion.findOne({
    noteId: req.params.id,
    version: parseInt(req.params.version),
    userId: req.user.id,
  });
  if (!version) return ApiResponse.error(res, 404, 'VERSION_NOT_FOUND', 'Version not found');
  ApiResponse.success(res, version);
});

const restoreVersion = asyncHandler(async (req, res) => {
  const version = await NoteVersion.findOne({
    noteId: req.params.id,
    version: parseInt(req.params.version),
    userId: req.user.id,
  });
  if (!version) return ApiResponse.error(res, 404, 'VERSION_NOT_FOUND', 'Version not found');

  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');

  // Save current as a new version before restoring
  await NoteVersion.create({
    noteId: note._id, userId: req.user.id, version: note.version,
    title: note.title, content: note.content, sizeBytes: JSON.stringify(note.content).length,
  });

  note.title = version.title;
  note.content = version.content;
  note.version += 1;
  note.lastEditedAt = new Date();
  await note.save();

  ApiResponse.success(res, note, 'Version restored');
});

module.exports = {
  getNotes, getNote, createNote, updateNote, deleteNote,
  restoreNote, permanentDelete, duplicateNote,
  togglePin, toggleStar, toggleArchive, toggleLock,
  updateColor, moveNote,
  bulkDelete, bulkMove, emptyTrash,
  getVersions, getVersion, restoreVersion,
};
