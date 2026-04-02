import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TouchGalClient } from '../data/TouchGalClient';

export interface AuthState {
  user: any | null;
  userProfile: any | null;
  userComments: any[];
  userRatings: any[];
  userCollections: any[];
  isLoginOpen: boolean;
  captchaUrl: string | null;
  captchaChallenge: { images: any[]; sessionId: string; target?: string } | null;
  sessionError: 'SESSION_EXPIRED' | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string, captcha: string) => Promise<void>;
  logout: () => Promise<void>;
  setIsLoginOpen: (isOpen: boolean) => void;
  setSessionError: (error: 'SESSION_EXPIRED' | null) => void;
  clearAuthUi: () => void;
  fetchCaptcha: () => Promise<void>;
  verifyCaptcha: (ids: string[]) => Promise<string | null>;
  fetchUserProfile: () => Promise<void>;
  fetchUserActivity: (type: 'comments' | 'ratings' | 'collections', page?: number) => Promise<void>;
}

const formatAuthError = (err: unknown): string => {
  const fallback = 'Login failed';
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : fallback;

  const validationPrefix = 'Error invoking remote method \'tg-login\': Error: ';
  const normalized = raw.startsWith(validationPrefix) ? raw.slice(validationPrefix.length) : raw;

  if (!normalized.startsWith('[')) {
    return normalized || fallback;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return normalized;

    const messages = parsed
      .map((item: any) => {
        const path = Array.isArray(item?.path) && item.path.length > 0 ? String(item.path[0]) : null;
        const message = typeof item?.message === 'string' ? item.message : null;
        if (!message) return null;
        return path ? `${path}: ${message}` : message;
      })
      .filter(Boolean);

    return messages.length > 0 ? messages.join('\n') : normalized;
  } catch {
    return normalized;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userProfile: null,
      userComments: [],
      userRatings: [],
      userCollections: [],
      isLoginOpen: false,
      captchaUrl: null,
      captchaChallenge: null,
      sessionError: null,
      isLoading: false,
      error: null,

      login: async (username, password, captcha) => {
        set({ isLoading: true, error: null });
        try {
          const user = await TouchGalClient.login(username, password, captcha);
          set({ user, isLoading: false, sessionError: null, captchaUrl: null, captchaChallenge: null });
        } catch (err: any) {
          set({ error: formatAuthError(err), isLoading: false, captchaUrl: null, captchaChallenge: null });
        }
      },
      logout: async () => {
        try {
          await TouchGalClient.logout();
        } catch (err) {
          console.error('Failed to clear main-process session token:', err);
        } finally {
          set({
            user: null,
            userProfile: null,
            userComments: [],
            userRatings: [],
            userCollections: [],
            sessionError: null,
            captchaUrl: null,
            captchaChallenge: null,
            error: null,
            isLoading: false
          });
        }
      },
      setIsLoginOpen: (isOpen) => set({ isLoginOpen: isOpen }),
      setSessionError: (error) => set({ sessionError: error }),
      clearAuthUi: () => set({ error: null, captchaUrl: null, captchaChallenge: null, isLoading: false }),
      fetchCaptcha: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await TouchGalClient.fetchCaptcha();
          if (data.images && data.sessionId) set({ captchaChallenge: data, captchaUrl: null, isLoading: false });
          else set({ captchaUrl: data.url || data, captchaChallenge: null, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },
      verifyCaptcha: async (ids) => {
        try {
          set({ isLoading: true, error: null });
          const result = await TouchGalClient.verifyCaptcha(get().captchaChallenge?.sessionId || '', ids);
          set({ isLoading: false });
          return result.code;
        } catch {
          set({ error: 'Captcha verification failed', isLoading: false });
          await get().fetchCaptcha();
          return null;
        }
      },
      fetchUserProfile: async () => {
        set({ isLoading: true });
        try {
          const selfStatus = await TouchGalClient.getUserStatusSelf();
          if (selfStatus?.uid || selfStatus?.id) {
            const uid = selfStatus.uid || selfStatus.id;
            const profileDetail = await TouchGalClient.getUserStatus(uid);
            set({ userProfile: profileDetail, user: { ...get().user, id: uid, uid }, isLoading: false });
            return;
          }
          set({ isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },
      fetchUserActivity: async (type, page = 1) => {
        const uid = get().userProfile?.id || get().user?.uid || get().user?.id;
        if (!uid) return;
        set({ isLoading: true });
        try {
          if (type === 'comments') {
            const data = await TouchGalClient.getUserComments(Number(uid), page, 20);
            set({ userComments: data.comments || [], isLoading: false });
          } else if (type === 'ratings') {
            const data = await TouchGalClient.getUserRatings(Number(uid), page, 20);
            set({ userRatings: data.ratings || [], isLoading: false });
          } else if (type === 'collections') {
            const data = await TouchGalClient.getFavoriteFolders(Number(uid));
            set({ userCollections: data || [], isLoading: false });
          }
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      }
    }),
    { name: 'touchgal-auth-storage' }
  )
);
