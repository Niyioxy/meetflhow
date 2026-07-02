import { secureStorage, userCache } from "./storage";
import { api } from "./api";
import type { User } from "@/types";

export async function loginWithGoogleToken(googleToken: string): Promise<{ token: string; user: User }> {
  const result = await api.auth.login(googleToken);
  if (result.error) throw new Error(result.error);

  await secureStorage.setToken(result.token);
  await userCache.set(result.user);

  return result as { token: string; user: User };
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await secureStorage.getToken();
  if (!token) return null;

  try {
    const user = await api.auth.me();
    await userCache.set(user);
    return user as User;
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") {
      await signOut();
    }
    return null;
  }
}

export async function signOut(): Promise<void> {
  await secureStorage.removeToken();
  await userCache.remove();
}
