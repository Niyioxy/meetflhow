import { useRef, useEffect, useCallback } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { useRecordingStore } from "@/store/recordingStore";
import { isOnline, saveOfflineRecording } from "@/lib/offline";
import { api } from "@/lib/api";

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
    const online = await isOnline();

    if (online) {
      try {
        const audioData = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await api.sync([{ id: Date.now().toString(), title, platform: store.platform, recorded_at: new Date().toISOString(), duration: durationSec, audio_base64: audioData }]);
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        await saveToOffline(uri, title, durationSec, store.platform);
      }
    } else {
      await saveToOffline(uri, title, durationSec, store.platform);
    }

    store.setStatus("done");
    setTimeout(() => store.reset(), 3000);
  }, [store]);

  async function saveToOffline(uri: string, title: string, duration: number, platform: string) {
    await ensureDir();
    const dest = `${OFFLINE_DIR}${Date.now()}.m4a`;
    await FileSystem.moveAsync({ from: uri, to: dest });
    await saveOfflineRecording({
      id: Date.now().toString(),
      title,
      platform,
      recorded_at: new Date().toISOString(),
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
