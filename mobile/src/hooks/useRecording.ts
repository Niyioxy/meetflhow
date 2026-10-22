import { useRef, useEffect, useCallback } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { useRecordingStore } from "@/store/recordingStore";
import { isOnline, saveOfflineRecording } from "@/lib/offline";
import { api } from "@/lib/api";
import { uploadRecordingFile } from "@/lib/upload";

const OFFLINE_DIR = `${FileSystem.documentDirectory}offline-recordings/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(OFFLINE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true });
}

export function useRecording() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const store = useRecordingStore();
  const startTimeRef = useRef<number>(0);

  const requestPermission = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert("Permission required", "Microphone access is needed to record meetings.");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
      (status) => {
        if (status.isRecording && status.metering !== undefined) {
          const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
          store.addMeteringLevel(normalized);
        }
      },
      100
    );

    recordingRef.current = recording;
    startTimeRef.current = Date.now();
    store.setStatus("recording");

    timerRef.current = setInterval(() => {
      store.setElapsed(Date.now() - startTimeRef.current);
    }, 1000);
  }, [store]);

  const pauseRecording = useCallback(async () => {
    await recordingRef.current?.pauseAsync();
    store.setStatus("paused");
    if (timerRef.current) clearInterval(timerRef.current);
  }, [store]);

  const resumeRecording = useCallback(async () => {
    await recordingRef.current?.startAsync();
    store.setStatus("recording");
    const pausedAt = Date.now() - store.elapsedMs;
    startTimeRef.current = pausedAt;
    timerRef.current = setInterval(() => {
      store.setElapsed(Date.now() - startTimeRef.current);
    }, 1000);
  }, [store]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    store.setStatus("processing");
    await recordingRef.current.stopAndUnloadAsync();

    const uri = recordingRef.current.getURI();
    recordingRef.current = null;

    if (!uri) {
      store.setStatus("error");
      return;
    }

    const title = store.title || `Meeting ${new Date().toLocaleDateString()}`;
    const durationSec = Math.round(store.elapsedMs / 1000);
    // One id for this recording across the immediate attempt and any offline
    // retry, so the server can recognise a recording it already received.
    const localId = Date.now().toString();
    const recordedAt = new Date().toISOString();
    const online = await isOnline();

    let uploaded = false;
    if (online) {
      try {
        const blobUrl = await uploadRecordingFile(uri, localId);
        const result = await api.sync([{ id: localId, title, platform: store.platform, recorded_at: recordedAt, duration: durationSec, blob_url: blobUrl }]);
        uploaded = (result as { results?: Array<{ status: string }> }).results?.[0]?.status === "queued";
      } catch {
        uploaded = false;
      }
    }

    // Only discard the audio once the server confirms it's queued; anything
    // else keeps it in the offline queue for the next sync.
    if (uploaded) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } else {
      await saveToOffline(uri, localId, recordedAt, title, durationSec, store.platform);
    }

    store.setStatus("done");
    setTimeout(() => store.reset(), 3000);
  }, [store]);

  async function saveToOffline(
    uri: string,
    id: string,
    recordedAt: string,
    title: string,
    duration: number,
    platform: string
  ) {
    await ensureDir();
    const dest = `${OFFLINE_DIR}${id}.m4a`;
    await FileSystem.moveAsync({ from: uri, to: dest });
    await saveOfflineRecording({
      id,
      title,
      platform,
      recorded_at: recordedAt,
      duration,
      file_path: dest,
    });
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { startRecording, pauseRecording, resumeRecording, stopRecording, requestPermission };
}
