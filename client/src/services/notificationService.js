import { useUIStore } from '../store/uiStore';

let toastId = 0;

export function showToast(message, type = 'info', duration = 3000) {
  const id = ++toastId;
  useUIStore.getState().addToast({ id, message, type, duration });
  setTimeout(() => {
    useUIStore.getState().removeToast(id);
  }, duration);
}

export function showSuccess(message) { showToast(message, 'success'); }
export function showError(message) { showToast(message, 'error', 5000); }
export function showWarning(message) { showToast(message, 'warning', 4000); }
