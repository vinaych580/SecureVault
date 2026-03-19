import { openDB } from 'idb';

const DB_NAME = 'securevault';
const DB_VERSION = 3;

let dbPromise = null;

function emitStorageChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('vault:storage-changed'));
  }
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('userId', 'userId');
          noteStore.createIndex('folderId', 'metadata.folderId');
          noteStore.createIndex('syncStatus', 'syncStatus');
          noteStore.createIndex('lastModified', 'metadata.lastEditedAt');
        }
        // Folders
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (db.objectStoreNames.contains('syncQueue')) {
          db.deleteObjectStore('syncQueue');
        }
        if (db.objectStoreNames.contains('settings')) {
          db.deleteObjectStore('settings');
        }
        if (db.objectStoreNames.contains('pendingVersions')) {
          db.deleteObjectStore('pendingVersions');
        }
      },
    });
  }
  return dbPromise;
}

// ────── Notes CRUD ──────
export async function saveNote(note) {
  const db = await getDB();
  if (note.encrypted && note.metadata) {
    const record = {
      ...note,
      id: note._id || note.id || crypto.randomUUID(),
    };
    await db.put('notes', record);
    emitStorageChange();
    return record;
  }

  const record = {
    id: note._id || note.id || crypto.randomUUID(),
    encrypted: { title: note.title, content: note.content, preview: note.preview, tags: note.tags },
    metadata: {
      folderId: note.folderId || null,
      color: note.color || null,
      isPinned: note.isPinned || false,
      isLocked: note.isLocked || false,
      isTrashed: note.isTrashed || false,
      isArchived: note.isArchived || false,
      isStarred: note.isStarred || false,
      version: note.version || 1,
      checksum: note.checksum || null,
      lastEditedAt: note.lastEditedAt || new Date().toISOString(),
      createdAt: note.createdAt || new Date().toISOString(),
    },
    syncStatus: note.syncStatus || 'pending_create',
    serverVersion: note.serverVersion ?? 0,
  };
  await db.put('notes', record);
  emitStorageChange();
  return record;
}

export async function getNote(id) {
  const db = await getDB();
  return db.get('notes', id);
}

export async function getAllNotes() {
  const db = await getDB();
  return db.getAll('notes');
}

export async function deleteNote(id) {
  const db = await getDB();
  await db.delete('notes', id);
  emitStorageChange();
}

export async function getFolders() {
  const db = await getDB();
  return db.getAll('folders');
}

export async function getFolder(id) {
  const db = await getDB();
  return db.get('folders', id);
}

export async function saveFolder(folder) {
  const db = await getDB();
  const record = { id: folder._id || folder.id, ...folder };
  await db.put('folders', record);
  emitStorageChange();
  return record;
}

export async function deleteFolder(id) {
  const db = await getDB();
  await db.delete('folders', id);
  emitStorageChange();
}
