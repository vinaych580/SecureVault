import { create } from 'zustand';

export const useUIStore = create((set) => ({
  toasts: [],

  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, { id: Date.now(), ...toast }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
