import { useEffect, useRef, useCallback, useState } from "react";
import { AppState, Vibration } from "react-native";
import { Audio } from "expo-av";
import { api } from "@/lib/api";

type CommandHandler = (command: string, payload?: string) => void;

const CLIP_DURATION_MS = 3000;

export function useVoiceCommands(enabled: boolean, onCommand: CommandHandler) {
  const [isListening, setIsListening] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  const onCommandRef = useRef(onCommand);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);

  const captureAndAnalyse = useCallback(async () => {
    if (!enabledRef.current) return;

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      recordingRef.current = recording;

      await new Promise((r) => setTimeout(r, CLIP_DURATION_MS));

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri || !enabledRef.current) return;

      const response = await fetch(uri);
      const blob = await response.blob();

      const result = await api.voiceCommand(blob, CLIP_DURATION_MS / 1000) as {
        command?: string;
        payload?: string;
        confidence?: number;
      };

      if (result.command && (result.confidence ?? 0) > 0.7) {
        Vibration.vibrate(100);
        onCommandRef.current(result.command, result.payload);
      }
    } catch {
      // silently ignore clip errors
    }

    if (enabledRef.current) {
      loopRef.current = setTimeout(captureAndAnalyse, 500);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsListening(false);
      if (loopRef.current) clearTimeout(loopRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      return;
    }

    setIsListening(true);
    captureAndAnalyse();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && loopRef.current) {
        clearTimeout(loopRef.current);
      } else if (state === "active" && enabledRef.current) {
        captureAndAnalyse();
      }
    });

    return () => {
      sub.remove();
      if (loopRef.current) clearTimeout(loopRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    };
  }, [enabled, captureAndAnalyse]);

  return { isListening };
}
