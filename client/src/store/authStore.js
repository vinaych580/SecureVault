import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  vaultKey: null, // CryptoKey — volatile memory ONLY
  isAuthenticated: false,
  isLocked: true,
  loading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: true }),
  setVaultKey: (key) => set({ vaultKey: key, isLocked: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  lockVault: () => set({ vaultKey: null, isLocked: true }),

  logout: () => set({
    user: null,
    vaultKey: null,
    isAuthenticated: false,
    isLocked: true,
    loading: false,
    error: null,
  }),
}));
