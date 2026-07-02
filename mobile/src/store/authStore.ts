import { create } from "zustand";
import type { User } from "@/types";
import { signOut as authSignOut, getCurrentUser } from "@/lib/auth";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  loadUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  loadUser: async () => {
    set({ isLoading: true });
    const user = await getCurrentUser();
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  signOut: async () => {
    await authSignOut();
    set({ user: null, isAuthenticated: false });
  },
}));
