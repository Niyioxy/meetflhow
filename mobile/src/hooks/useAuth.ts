import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, loadUser, signOut } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return { user, isLoading, isAuthenticated, setUser, signOut };
}
