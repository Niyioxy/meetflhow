import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OfflineRecording } from "@/types";

const QUEUE_KEY = "offline_recordings_queue";

export async function isOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function getPendingRecordings(): Promise<OfflineRecording[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const all: OfflineRecording[] = JSON.parse(raw);
    return all.filter((r) => !r.synced);
  } catch {
    return [];
  }
}

export async function getAllOfflineRecordings(): Promise<OfflineRecording[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineRecording(recording: Omit<OfflineRecording, "synced">): Promise<void> {
  const all = await getAllOfflineRecordings();
  all.push({ ...recording, synced: false });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all));
}

export async function markAsSynced(id: string): Promise<void> {
  const all = await getAllOfflineRecordings();
  const updated = all.map((r) => (r.id === id ? { ...r, synced: true } : r));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function removeRecording(id: string): Promise<void> {
  const all = await getAllOfflineRecordings();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all.filter((r) => r.id !== id)));
}

export async function clearSyncedRecordings(): Promise<void> {
  const all = await getAllOfflineRecordings();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all.filter((r) => !r.synced)));
}

export async function clearAllPending(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function getOfflineStorageInfo(): Promise<{ pendingCount: number; totalMb: string }> {
  const pending = await getPendingRecordings();
  return {
    pendingCount: pending.length,
    totalMb: "–",
  };
}
