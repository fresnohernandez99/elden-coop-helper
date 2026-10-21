import { create } from 'zustand';

const TOAST_DURATION_MS = 4000;

interface ToastStore {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastStore>((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => set({ message: null }), TOAST_DURATION_MS);
  },
  hide: () => set({ message: null }),
}));

/** Shortcut for use outside components (stores, callbacks). */
export const showToast = (message: string) => useToastStore.getState().show(message);
