import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Role = 'user' | 'admin' | null;

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  role: Role;
  token: string | null;
  login: (user: User, role: Role, token: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      token: null,
      login: (user, role, token) => set({ user, role, token }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : state.user,
      })),
      logout: () => set({ user: null, role: null, token: null }),
    }),
    {
      name: 'adizes-auth-storage',
    }
  )
);
