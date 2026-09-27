import { create } from 'zustand';
import { User } from '../types';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  /** Email awaiting confirmation, held between signup and the verify click. */
  pendingVerificationEmail: string | null;
  /** Dev-only direct link, populated when SMTP is not configured. */
  pendingVerificationUrl: string | null;
  
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuthenticating: (isAuth: boolean) => void;
  setAuthError: (error: string | null) => void;
  clearAuthError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticating: true,
  authError: null,
  pendingVerificationEmail: null,
  pendingVerificationUrl: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setAuthenticating: (isAuth) => set({ isAuthenticating: isAuth }),
  setAuthError: (error) => set({ authError: error }),
  clearAuthError: () => set({ authError: null })
}));
