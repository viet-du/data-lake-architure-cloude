import { create } from 'zustand';

export type EUserRole = 'admin' | 'operator' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: EUserRole;
  avatarUrl?: string;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
  signOut: () => void;
}

const TOKEN_STORAGE_KEY = 'lakehouse.token';
const USER_STORAGE_KEY = 'lakehouse.user';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.localStorage === undefined || window.localStorage === null) return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  if (window.localStorage === undefined || window.localStorage === null) return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

const initialToken = readStoredToken();
const initialUser = readStoredUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: initialToken,
  isAuthenticated: initialToken !== null && initialUser !== null,
  setUser: (user: UserProfile | null) => {
    if (typeof window !== 'undefined') {
      if (user) window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      else window.localStorage.removeItem(USER_STORAGE_KEY);
    }
    set((state: AuthState) => ({ user, isAuthenticated: state.token !== null && user !== null }));
  },
  setToken: (token: string | null) => {
    if (typeof window !== 'undefined') {
      if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    set((state: AuthState) => ({ token, isAuthenticated: token !== null && state.user !== null }));
  },
  signOut: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
