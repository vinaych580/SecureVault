import api from './api';
import {
  deleteFolder as deleteLocalFolder,
  deleteNote as deleteLocalNote,
  getAllNotes,
  getFolders,
  saveFolder,
  saveNote,
} from './offlineDB';

export const PENDING_SYNC_STATUSES = new Set(['pending_create', 'pending_update', 'pending_delete']);

const REMOTE_NOTES_PAGE_SIZE = 200;

function mapRemoteNoteToLocal(note) {
  const id = String(note._id);

  return {
    id,
    _id: id,
    encrypted: {
      title: note.title,
      content: note.content,
      preview: note.preview,
      tags: note.tags || [],
    },
    metadata: {
      folderId: note.folderId ? String(note.folderId) : null,
      color: note.color || null,
      isPinned: !!note.isPinned,
      isLocked: !!note.isLocked,
      isTrashed: !!note.isTrashed,
      isArchived: !!note.isArchived,
      isStarred: !!note.isStarred,
      version: note.version || 1,
      checksum: note.checksum || null,
      lastEditedAt: note.lastEditedAt || note.updatedAt || new Date().toISOString(),
      createdAt: note.createdAt || note.updatedAt || new Date().toISOString(),
    },
    syncStatus: 'synced',
    serverVersion: note.version || 1,
  };
}

function mapRemoteFolderToLocal(folder) {
  const id = String(folder._id);

  return {
    id,
    _id: id,
    encryptedName: folder.name,
    color: folder.color || null,
    order: folder.order || 0,
    createdAt: folder.createdAt || new Date().toISOString(),
    lastEditedAt: folder.updatedAt || folder.createdAt || new Date().toISOString(),
    syncStatus: 'synced',
  };
}

async function fetchAllRemoteNotes() {
  const items = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await api.get('/notes', {
      params: { page, limit: REMOTE_NOTES_PAGE_SIZE },
    });

    const data = response.data.data || {};
    items.push(...(data.items || []));
    hasMore = !!data.hasMore;
    page += 1;
  }

  return items;
}

export async function hydrateVaultFromServer() {
  if (!sessionStorage.getItem('accessToken')) {
    return;
  }

  const [remoteFoldersResponse, remoteNotes, localNotes, localFolders] = await Promise.all([
    api.get('/folders'),
    fetchAllRemoteNotes(),
    getAllNotes(),
    getFolders(),
  ]);

  const remoteFolders = remoteFoldersResponse.data.data || [];
  const localNotesById = new Map(localNotes.map((note) => [note.id, note]));
  const localFoldersById = new Map(localFolders.map((folder) => [folder.id, folder]));
  const remoteNoteIds = new Set();
  const remoteFolderIds = new Set();

  for (const remoteNote of remoteNotes) {
    const id = String(remoteNote._id);
    const localNote = localNotesById.get(id);

    remoteNoteIds.add(id);

    if (localNote && PENDING_SYNC_STATUSES.has(localNote.syncStatus)) {
      continue;
    }

    await saveNote(mapRemoteNoteToLocal(remoteNote));
  }

  for (const remoteFolder of remoteFolders) {
    const id = String(remoteFolder._id);
    const localFolder = localFoldersById.get(id);

    remoteFolderIds.add(id);

    if (localFolder && PENDING_SYNC_STATUSES.has(localFolder.syncStatus)) {
      continue;
    }

    await saveFolder(mapRemoteFolderToLocal(remoteFolder));
  }

  for (const localNote of localNotes) {
    if (localNote.syncStatus === 'synced' && !remoteNoteIds.has(localNote.id)) {
      await deleteLocalNote(localNote.id);
    }
  }

  for (const localFolder of localFolders) {
    if (localFolder.syncStatus === 'synced' && !remoteFolderIds.has(localFolder.id)) {
      await deleteLocalFolder(localFolder.id);
    }
  }
}
