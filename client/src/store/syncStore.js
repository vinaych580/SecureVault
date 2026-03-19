import { create } from 'zustand';

export const useSyncStore = create((set) => ({
  isOnline: navigator.onLine,
  syncStatus: 'idle', // 'idle' | 'syncing' | 'error'
  pendingCount: 0,
  lastSyncAt: null,
  conflicts: [],

  setOnline: (isOnline) => set({ isOnline }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setLastSync: (date) => set({ lastSyncAt: date }),
  addConflict: (conflict) => set((s) => ({ conflicts: [...s.conflicts, conflict] })),
  removeConflict: (noteId) => set((s) => ({ conflicts: s.conflicts.filter((c) => c.noteId !== noteId) })),
  clearConflicts: () => set({ conflicts: [] }),
}));
