import { create } from "zustand";

type RecordingStatus = "idle" | "recording" | "paused" | "processing" | "done" | "error";

interface RecordingState {
  status: RecordingStatus;
  elapsedMs: number;
  title: string;
  platform: string;
  isOffline: boolean;
  meteringLevels: number[];
  setStatus: (status: RecordingStatus) => void;
  setElapsed: (ms: number) => void;
  setTitle: (title: string) => void;
  setPlatform: (platform: string) => void;
  setOffline: (offline: boolean) => void;
  addMeteringLevel: (level: number) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  status: "idle",
  elapsedMs: 0,
  title: "",
  platform: "other",
  isOffline: false,
  meteringLevels: [],

  setStatus: (status) => set({ status }),
  setElapsed: (elapsedMs) => set({ elapsedMs }),
  setTitle: (title) => set({ title }),
  setPlatform: (platform) => set({ platform }),
  setOffline: (isOffline) => set({ isOffline }),

  addMeteringLevel: (level) =>
    set((s) => ({
      meteringLevels: [...s.meteringLevels.slice(-39), level],
    })),

  reset: () =>
    set({
      status: "idle",
      elapsedMs: 0,
      title: "",
      platform: "other",
      isOffline: false,
      meteringLevels: [],
    }),
}));
