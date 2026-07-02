import { secureStorage } from "./storage";
import { MeetingDetail, MeetingSummary, Task, Todo } from "@/types";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function authFetch(path: string, init: RequestInit = {}) {
  const token = await secureStorage.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (googleToken: string) =>
      fetch(`${BASE}/api/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleToken }),
      }).then((r) => r.json()),
    me: () => authFetch("/api/mobile/auth/me"),
  },

  meetings: {
    list: (page = 1, limit = 20): Promise<{ data: MeetingSummary[]; page: number; limit: number }> =>
      authFetch(`/api/mobile/meetings?page=${page}&limit=${limit}`),
    get: (id: string): Promise<MeetingDetail> =>
      authFetch(`/api/mobile/meetings/${id}`),
  },

  tasks: {
    list: (page = 1, limit = 20): Promise<{ data: Task[]; page: number; limit: number }> =>
      authFetch(`/api/mobile/tasks?page=${page}&limit=${limit}`),
    update: (id: string, data: Partial<Task>) =>
      authFetch(`/api/mobile/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  todos: {
    list: (page = 1, limit = 20): Promise<{ data: Todo[]; page: number; limit: number }> =>
      authFetch(`/api/mobile/todos?page=${page}&limit=${limit}`),
    update: (id: string, data: Partial<Todo>) =>
      authFetch(`/api/mobile/todos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  voiceCommand: async (audioBlob: Blob, duration: number) => {
    const token = await secureStorage.getToken();
    const form = new FormData();
    form.append("audio", audioBlob, "clip.m4a");
    form.append("duration", String(duration));

    const res = await fetch(`${BASE}/api/voice-command`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    return res.json();
  },

  sync: async (recordings: object[]) => {
    return authFetch("/api/mobile/sync", {
      method: "POST",
      body: JSON.stringify({ recordings }),
    });
  },
};
