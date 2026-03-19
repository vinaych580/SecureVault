import { useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  deleteFolder,
  deleteNote,
  getAllNotes,
  getFolders,
  getNote,
  saveFolder,
  saveNote,
} from '../services/offlineDB';
import { PENDING_SYNC_STATUSES } from '../services/vaultSyncService';
import { useSyncStore } from '../store/syncStore';

const isObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

const buildDelta = (record) => {
  const { id, encrypted = {}, metadata = {}, syncStatus } = record;

  if (syncStatus === 'pending_delete') {
    if (!isObjectId(id)) {
      return null;
    }

    return {
      id,
      clientId: id,
      action: 'delete',
      version: metadata.version || 1,
    };
  }

  return {
    clientId: id,
    ...(syncStatus === 'pending_create' && !isObjectId(id) ? {} : { id }),
    title: encrypted.title,
    content: encrypted.content,
    preview: encrypted.preview,
    tags: encrypted.tags || [],
    folderId: metadata.folderId || null,
    color: metadata.color || null,
    isPinned: !!metadata.isPinned,
    isLocked: !!metadata.isLocked,
    isTrashed: !!metadata.isTrashed,
    isArchived: !!metadata.isArchived,
    isStarred: !!metadata.isStarred,
    checksum: metadata.checksum || null,
    version: metadata.version || 1,
    lastEditedAt: metadata.lastEditedAt || new Date().toISOString(),
  };
};

export const useSyncEngine = () => {
  const syncStore = useSyncStore();
  const inFlightRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const [notes, folders] = await Promise.all([getAllNotes(), getFolders()]);
    const pendingNotes = notes.filter((note) => PENDING_SYNC_STATUSES.has(note.syncStatus)).length;
    const pendingFolders = folders.filter((folder) => PENDING_SYNC_STATUSES.has(folder.syncStatus)).length;

    syncStore.setPendingCount(pendingNotes + pendingFolders);
  }, [syncStore]);

  const syncFolders = useCallback(async () => {
    const folders = await getFolders();
    const pendingFolders = folders.filter((folder) => PENDING_SYNC_STATUSES.has(folder.syncStatus));

    for (const folder of pendingFolders) {
      const folderId = folder.id || folder._id;

      if (folder.syncStatus === 'pending_delete') {
        if (isObjectId(folderId)) {
          await api.delete(`/folders/${folderId}`);
        }

        await deleteFolder(folderId);
        continue;
      }

      const payload = {
        id: folderId,
        name: folder.encryptedName,
        color: folder.color || null,
      };

      let response;
      if (folder.syncStatus === 'pending_create') {
        response = await api.post('/folders', payload);
      } else {
        response = await api.put(`/folders/${folderId}`, {
          name: folder.encryptedName,
          color: folder.color || null,
        });
      }

      const remoteFolder = response.data.data;
      const nextId = remoteFolder?._id ? String(remoteFolder._id) : folderId;

      await saveFolder({
        ...folder,
        id: nextId,
        _id: nextId,
        encryptedName: remoteFolder?.name || folder.encryptedName,
        color: remoteFolder?.color ?? folder.color,
        order: remoteFolder?.order ?? folder.order ?? 0,
        createdAt: remoteFolder?.createdAt || folder.createdAt || new Date().toISOString(),
        lastEditedAt: remoteFolder?.updatedAt || folder.lastEditedAt || new Date().toISOString(),
        syncStatus: 'synced',
      });

      if (nextId !== folderId) {
        await deleteFolder(folderId);
      }
    }
  }, []);

  const syncNotes = useCallback(async () => {
    const notes = await getAllNotes();
    const pendingNotes = notes.filter((note) => PENDING_SYNC_STATUSES.has(note.syncStatus));

    if (pendingNotes.length === 0) {
      return 0;
    }

    const modifications = [];

    for (const record of pendingNotes) {
      if (record.syncStatus === 'pending_delete' && !isObjectId(record.id)) {
        await deleteNote(record.id);
        continue;
      }

      const delta = buildDelta(record);
      if (delta) {
        modifications.push(delta);
      }
    }

    if (modifications.length === 0) {
      return 0;
    }

    const response = await api.post('/sync/delta', { modifications });
    const successes = response.data.data?.successes || [];
    const conflicts = response.data.data?.conflicts || [];

    for (const success of successes) {
      const localId = success.clientId || success.id;
      if (!localId) {
        continue;
      }

      if (success.status === 'deleted') {
        await deleteNote(localId);
        continue;
      }

      const existingRecord = await getNote(localId);
      if (!existingRecord) {
        continue;
      }

      const nextId = success.id || localId;
      const updatedRecord = {
        ...existingRecord,
        id: nextId,
        _id: nextId,
        syncStatus: 'synced',
        metadata: {
          ...existingRecord.metadata,
          version: success.version ?? existingRecord.metadata?.version ?? 1,
        },
        serverVersion: success.version ?? existingRecord.serverVersion ?? 0,
      };

      await saveNote(updatedRecord);
      if (nextId !== localId) {
        await deleteNote(localId);
      }
    }

    for (const conflict of conflicts) {
      syncStore.addConflict(conflict);

      const localId = conflict.clientId || conflict.noteId;
      if (!localId) {
        continue;
      }

      const existingRecord = await getNote(localId);
      if (!existingRecord) {
        continue;
      }

      await saveNote({ ...existingRecord, syncStatus: 'conflict' });
    }

    return conflicts.length;
  }, [syncStore]);

  const syncPending = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    await refreshPendingCount();

    if (!syncStore.isOnline || !sessionStorage.getItem('accessToken')) {
      return;
    }

    inFlightRef.current = true;
    syncStore.setSyncStatus('syncing');
    syncStore.clearConflicts();

    try {
      await syncFolders();
      const conflictCount = await syncNotes();

      syncStore.setLastSync(new Date().toISOString());
      syncStore.setSyncStatus(conflictCount > 0 ? 'error' : 'idle');
    } catch {
      syncStore.setSyncStatus('error');
    } finally {
      inFlightRef.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount, syncFolders, syncNotes, syncStore]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (syncStore.isOnline) {
      void syncPending();
    }
  }, [syncPending, syncStore.isOnline]);

  useEffect(() => {
    const handleStorageChange = () => {
      void refreshPendingCount();
      if (syncStore.isOnline) {
        void syncPending();
      }
    };

    window.addEventListener('vault:storage-changed', handleStorageChange);
    return () => window.removeEventListener('vault:storage-changed', handleStorageChange);
  }, [refreshPendingCount, syncPending, syncStore.isOnline]);

  useEffect(() => {
    const interval = setInterval(() => {
      void syncPending();
    }, 30000);

    return () => clearInterval(interval);
  }, [syncPending]);

  return { forceSync: syncPending, refreshPendingCount };
};
