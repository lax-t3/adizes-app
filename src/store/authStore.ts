import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Role = 'user' | 'admin' | null;

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  role: Role;
  token: string | null;
  login: (user: User, role: Role, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      token: null,
      login: (user, role, token) => set({ user, role, token }),
      logout: () => set({ user: null, role: null, token: null }),
    }),
    {
      name: 'adizes-auth-storage',
    }
  )
);
