"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useMediaRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => () => {
    stopTimer();
    cleanupStream();
  }, [stopTimer, cleanupStream]);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setSeconds(0);
    chunksRef.current = [];

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setAudioBlob(blob);
        cleanupStream();
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");

      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not access the microphone"
      );
    }
  }, [cleanupStream]);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    stopTimer();
    setStatus("paused");
  }, [stopTimer]);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    setStatus("recording");
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    stopTimer();
    setStatus("stopped");
  }, [stopTimer]);

  const reset = useCallback(() => {
    setStatus("idle");
    setSeconds(0);
    setAudioBlob(null);
    setError(null);
  }, []);

  return { status, seconds, audioBlob, error, stream, start, pause, resume, stop, reset };
}
