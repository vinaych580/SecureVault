const mongoose = require('mongoose');
const Note = require('../models/Note');
const SyncLog = require('../models/SyncLog');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ─── DELTA SYNC ───
const deltaSync = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const { modifications } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(modifications)) {
    return ApiResponse.error(res, 400, 'INVALID_PAYLOAD', 'modifications must be an array');
  }

  const successes = [];
  const conflicts = [];

  for (const delta of modifications) {
    const noteId = mongoose.isValidObjectId(delta.id) ? delta.id : null;
    const existing = noteId ? await Note.findOne({ _id: noteId, userId }) : null;

    if (existing) {
      if (existing.version > delta.version) {
        conflicts.push({
          noteId: delta.id,
          clientId: delta.clientId || null,
          serverVersion: existing.version,
          localVersion: delta.version,
          serverData: existing,
        });
      } else {
        // Apply update
        if (delta.title) existing.title = delta.title;
        if (delta.content) existing.content = delta.content;
        if (delta.preview) existing.preview = delta.preview;
        if (delta.tags) existing.tags = delta.tags;
        if (delta.folderId !== undefined) existing.folderId = delta.folderId || null;
        if (delta.color !== undefined) existing.color = delta.color || null;
        if (delta.isPinned !== undefined) existing.isPinned = !!delta.isPinned;
        if (delta.isLocked !== undefined) existing.isLocked = !!delta.isLocked;
        if (delta.isTrashed !== undefined) existing.isTrashed = !!delta.isTrashed;
        if (delta.isArchived !== undefined) existing.isArchived = !!delta.isArchived;
        if (delta.isStarred !== undefined) existing.isStarred = !!delta.isStarred;
        if (delta.checksum) existing.checksum = delta.checksum;
        existing.version = (existing.version || delta.version) + 1;
        existing.syncStatus = 'synced';
        existing.lastSyncedAt = new Date();
        existing.lastEditedAt = delta.lastEditedAt || new Date();
        await existing.save();
        successes.push({ id: String(existing._id), clientId: delta.clientId || delta.id || null, version: existing.version, status: 'synced' });
      }
    } else if (delta.action === 'delete') {
      if (noteId) {
        await Note.deleteOne({ _id: noteId, userId });
      }
      successes.push({ id: delta.id || null, clientId: delta.clientId || delta.id || null, status: 'deleted' });
    } else {
      // Create new
      const note = await Note.create({
        ...(noteId ? { _id: noteId } : {}),
        userId,
        title: delta.title,
        content: delta.content,
        preview: delta.preview,
        tags: delta.tags || [],
        folderId: delta.folderId || null,
        color: delta.color || null,
        isPinned: !!delta.isPinned,
        isLocked: !!delta.isLocked,
        isTrashed: !!delta.isTrashed,
        isArchived: !!delta.isArchived,
        isStarred: !!delta.isStarred,
        checksum: delta.checksum,
        version: delta.version || 1,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        lastEditedAt: delta.lastEditedAt || new Date(),
      });
      successes.push({ id: String(note._id), clientId: delta.clientId || delta.id || null, version: note.version, status: 'created' });
    }
  }

  // Log
  await SyncLog.create({
    userId,
    operation: 'PUSH',
    status: conflicts.length > 0 ? 'PARTIAL' : 'SUCCESS',
    notesAffected: successes.length,
    conflictsFound: conflicts.length,
    duration: Date.now() - startedAt,
    startedAt: new Date(startedAt),
    completedAt: new Date(),
  });

  ApiResponse.success(res, { successes, conflicts });
});

const resolveConflict = asyncHandler(async (req, res) => {
  const { resolution, localData } = req.body; // 'local' | 'cloud'
  const note = await Note.findOne({ _id: req.params.noteId, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');

  if (resolution === 'local' && localData) {
    note.title = localData.title;
    note.content = localData.content;
    note.preview = localData.preview;
    note.tags = localData.tags;
    note.checksum = localData.checksum;
    note.version += 1;
    note.syncStatus = 'synced';
    note.lastSyncedAt = new Date();
    await note.save();
  }
  // 'cloud' → do nothing, local should pull server version.

  ApiResponse.success(res, note, 'Conflict resolved');
});

const getSyncHistory = asyncHandler(async (req, res) => {
  const logs = await SyncLog.find({ userId: req.user.id })
    .sort({ startedAt: -1 })
    .limit(50);
  ApiResponse.success(res, logs);
});

module.exports = { deltaSync, resolveConflict, getSyncHistory };
