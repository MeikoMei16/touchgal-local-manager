import { create } from 'zustand';
import { TouchGalClient } from '../data/TouchGalClient';
import type { DeveloperApiStatus } from '../types/electron';

interface DeveloperApiState {
  status: DeveloperApiStatus | null;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

export const useDeveloperApiStore = create<DeveloperApiState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,
  refreshStatus: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const status = await TouchGalClient.getDeveloperApiStatus();
      set({ status, isLoading: false, error: null });
    } catch (error) {
      set({
        status: {
          configured: true,
          isDeveloperApiCredential: true,
          applicationStatus: 'error',
          dailyLimit: null,
          minuteLimit: null,
        },
        isLoading: false,
        error: error instanceof Error ? error.message : 'Developer API status unavailable',
      });
    }
  },
}));
