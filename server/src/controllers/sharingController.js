const ShareLink = require('../models/ShareLink');
const Note = require('../models/Note');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcrypt');
const { generateRandomHex, hashToken } = require('../utils/crypto');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const createShareLink = asyncHandler(async (req, res) => {
  const { expiresIn = 24, isPasswordProtected = false, password, maxViews } = req.body;
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return ApiResponse.error(res, 404, 'NOTE_NOT_FOUND', 'Note not found');

  if (expiresIn > 168) return ApiResponse.error(res, 400, 'INVALID_EXPIRY', 'Max expiry is 7 days');
  if (isPasswordProtected && !password) {
    return ApiResponse.error(res, 400, 'PASSWORD_REQUIRED', 'Password is required for protected share links');
  }

  const rawToken = generateRandomHex(24);
  const tokenHash = hashToken(rawToken);

  const shareData = {
    noteId: note._id,
    userId: req.user.id,
    tokenHash,
    encryptedContent: { title: note.title, content: note.content },
    isPasswordProtected,
    maxViews: maxViews || null,
    expiresAt: new Date(Date.now() + expiresIn * 60 * 60 * 1000),
  };

  if (isPasswordProtected && password) {
    shareData.passwordHash = await bcrypt.hash(password, 10);
  }

  await ShareLink.create(shareData);
  await AuditLog.logEvent(req.user.id, 'SHARE_LINK_CREATED', req, { noteId: note._id });

  ApiResponse.created(res, { token: rawToken, expiresAt: shareData.expiresAt });
});

const getNoteShareLinks = asyncHandler(async (req, res) => {
  const links = await ShareLink.find({ noteId: req.params.id, userId: req.user.id })
    .select('isPasswordProtected viewCount maxViews expiresAt createdAt');
  ApiResponse.success(res, links);
});

const revokeShareLink = asyncHandler(async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const link = await ShareLink.findOneAndDelete({ tokenHash, userId: req.user.id });
  if (!link) return ApiResponse.error(res, 404, 'LINK_NOT_FOUND', 'Share link not found');
  await AuditLog.logEvent(req.user.id, 'SHARE_LINK_REVOKED', req);
  ApiResponse.success(res, null, 'Share link revoked');
});

// Public endpoint — no auth required
const viewSharedNote = asyncHandler(async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const link = await ShareLink.findOne({ tokenHash });
  if (!link) return ApiResponse.error(res, 404, 'LINK_NOT_FOUND', 'Share link not found or expired');
  if (link.expiresAt <= new Date()) {
    return ApiResponse.error(res, 410, 'LINK_EXPIRED', 'Share link has expired');
  }

  if (link.maxViews && link.viewCount >= link.maxViews) {
    return ApiResponse.error(res, 410, 'LINK_EXHAUSTED', 'Max views reached');
  }

  if (!link.isPasswordProtected) {
    link.viewCount += 1;
    await link.save();
  }

  ApiResponse.success(res, {
    needsPassword: link.isPasswordProtected,
    encryptedContent: link.isPasswordProtected ? null : link.encryptedContent,
  });
});

const verifySharePassword = asyncHandler(async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const link = await ShareLink.findOne({ tokenHash });
  if (!link) return ApiResponse.error(res, 404, 'LINK_NOT_FOUND', 'Share link not found');
  if (link.expiresAt <= new Date()) {
    return ApiResponse.error(res, 410, 'LINK_EXPIRED', 'Share link has expired');
  }
  if (!link.isPasswordProtected || !link.passwordHash) {
    return ApiResponse.error(res, 400, 'PASSWORD_NOT_REQUIRED', 'This share link is not password protected');
  }
  if (link.maxViews && link.viewCount >= link.maxViews) {
    return ApiResponse.error(res, 410, 'LINK_EXHAUSTED', 'Max views reached');
  }

  const isMatch = await bcrypt.compare(req.body.password, link.passwordHash);
  if (!isMatch) return ApiResponse.error(res, 401, 'WRONG_PASSWORD', 'Incorrect password');

  link.viewCount += 1;
  await link.save();

  ApiResponse.success(res, { encryptedContent: link.encryptedContent });
});

module.exports = { createShareLink, getNoteShareLinks, revokeShareLink, viewSharedNote, verifySharePassword };
