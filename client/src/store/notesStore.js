import { create } from 'zustand';

export const useNotesStore = create((set, get) => ({
  notes: [],
  folders: [],
  activeNote: null,
  filters: {
    folderId: null,
    starred: false,
    archived: false,
    trashed: false,
    searchQuery: '',
  },
  sort: { by: 'lastEditedAt', order: 'desc' },

  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, updates) => set((s) => ({
    notes: s.notes.map((n) => (n._id === id || n.id === id ? { ...n, ...updates } : n)),
    activeNote: s.activeNote && (s.activeNote._id === id || s.activeNote.id === id)
      ? { ...s.activeNote, ...updates } : s.activeNote,
  })),
  removeNote: (id) => set((s) => ({
    notes: s.notes.filter((n) => n._id !== id && n.id !== id),
    activeNote: s.activeNote && (s.activeNote._id === id || s.activeNote.id === id) ? null : s.activeNote,
  })),

  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
  updateFolder: (id, updates) => set((s) => ({
    folders: s.folders.map((f) => (f._id === id || f.id === id ? { ...f, ...updates } : f)),
  })),
  removeFolder: (id) => set((s) => ({
    folders: s.folders.filter((f) => f._id !== id && f.id !== id),
    // Move notes in this folder to root (null folderId)
    notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
  })),

  setActiveNote: (note) => set({ activeNote: note }),
  clearActiveNote: () => set({ activeNote: null }),

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { folderId: null, starred: false, archived: false, trashed: false, searchQuery: '' } }),
  setSort: (by, order) => set({ sort: { by, order } }),
}));
