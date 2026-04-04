import { create } from 'zustand';
import type { LocalCollection, LocalCollectionGameInput } from '../types/electron';

interface LocalCollectionState {
  collections: LocalCollection[];
  hasLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  fetchCollections: (force?: boolean) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  deleteCollection: (collectionId: number) => Promise<void>;
  addToCollection: (collectionId: number, game: LocalCollectionGameInput) => Promise<void>;
  removeFromCollection: (collectionId: number, uniqueId: string) => Promise<void>;
  createCollectionAndAdd: (name: string, game: LocalCollectionGameInput) => Promise<void>;
}

const normalizeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Local collection operation failed';

export const useLocalCollectionStore = create<LocalCollectionState>()((set, get) => ({
  collections: [],
  hasLoaded: false,
  isLoading: false,
  error: null,
  fetchCollections: async (force = false) => {
    if (get().hasLoaded && !force) return;
    set({ isLoading: true, error: null });
    try {
      const collections = await window.api.getLocalCollections();
      set({ collections, hasLoaded: true, isLoading: false });
    } catch (error) {
      set({ error: normalizeError(error), isLoading: false });
    }
  },
  createCollection: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const collections = await window.api.createLocalCollection(name);
      set({ collections, hasLoaded: true, isLoading: false });
    } catch (error) {
      const message = normalizeError(error);
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },
  deleteCollection: async (collectionId: number) => {
    set({ isLoading: true, error: null });
    try {
      const collections = await window.api.deleteLocalCollection(collectionId);
      set({ collections, hasLoaded: true, isLoading: false });
    } catch (error) {
      const message = normalizeError(error);
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },
  addToCollection: async (collectionId: number, game: LocalCollectionGameInput) => {
    set({ isLoading: true, error: null });
    try {
      const collections = await window.api.addLocalCollectionItem(collectionId, game);
      set({ collections, hasLoaded: true, isLoading: false });
    } catch (error) {
      const message = normalizeError(error);
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },
  removeFromCollection: async (collectionId: number, uniqueId: string) => {
    set({ isLoading: true, error: null });
    try {
      const collections = await window.api.removeLocalCollectionItem(collectionId, uniqueId);
      set({ collections, hasLoaded: true, isLoading: false });
    } catch (error) {
      const message = normalizeError(error);
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },
  createCollectionAndAdd: async (name: string, game: LocalCollectionGameInput) => {
    const previousIds = new Set(get().collections.map((collection) => collection.id));
    await get().createCollection(name);
    const created = get().collections.find((collection) => !previousIds.has(collection.id));
    if (!created) {
      throw new Error('Collection creation result was not found');
    }
    await get().addToCollection(created.id, game);
  }
}));
