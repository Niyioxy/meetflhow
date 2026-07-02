import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "mobile_auth_token";
const USER_KEY = "mobile_user";

export const secureStorage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  removeToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove: (key: string) => AsyncStorage.removeItem(key),
};

export const userCache = {
  get: () => cache.get<{ id: string; email: string; name: string | null; image: string | null; role: string }>(USER_KEY),
  set: (user: object) => cache.set(USER_KEY, user),
  remove: () => cache.remove(USER_KEY),
};
