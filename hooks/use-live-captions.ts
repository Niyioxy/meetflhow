"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";

export interface CaptionLine {
  id: string;
  original: string;
  translated: string | null;
  translating: boolean;
}

export type LiveCaptionStatus = "idle" | "connecting" | "live" | "error";

const MAX_LINES = 20;

function pickCaptionMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useLiveCaptions() {
  const [status, setStatus] = useState<LiveCaptionStatus>("idle");
  const [targetLanguage, setTargetLanguage] = useState<Locale | null>(null);
  const [lines, setLines] = useState<CaptionLine[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const targetLanguageRef = useRef<Locale | null>(null);
  targetLanguageRef.current = targetLanguage;

  const translateLine = useCallback(async (id: string, text: string, language: Locale) => {
    try {
      const res = await fetch("/api/live-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_language: language }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLines((prev) =>
        prev.map((l) => (l.id === id ? { ...l, translated: data.translated, translating: false } : l))
      );
    } catch {
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, translating: false } : l)));
    }
  }, []);

  const teardown = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const start = useCallback(
    async (stream: MediaStream) => {
      teardown();
      setStatus("connecting");
      setLines([]);

      try {
        const tokenRes = await fetch("/api/meetings/live-caption-token", { method: "POST" });
        if (!tokenRes.ok) throw new Error("Failed to get caption token");
        const { key } = await tokenRes.json();

        const params = new URLSearchParams({
          model: "nova-3",
          smart_format: "true",
          interim_results: "true",
          punctuate: "true",
          endpointing: "300",
          language: "multi",
        });
        const socket = new WebSocket(
          `wss://api.deepgram.com/v1/listen?${params.toString()}`,
          ["token", key]
        );
        socketRef.current = socket;

        socket.onopen = () => {
          setStatus("live");
          const mimeType = pickCaptionMimeType();
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
              socket.send(e.data);
            }
          };
          recorder.start(250);
          recorderRef.current = recorder;
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const alt = data?.channel?.alternatives?.[0];
            const text: string | undefined = alt?.transcript;
            if (!data?.is_final || !text || !text.trim()) return;

            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const language = targetLanguageRef.current;
            setLines((prev) => [
              ...prev.slice(-(MAX_LINES - 1)),
              { id, original: text, translated: null, translating: !!language },
            ]);
            if (language) translateLine(id, text, language);
          } catch {
            // ignore malformed frames
          }
        };

        socket.onerror = () => setStatus("error");
      } catch {
        setStatus("error");
      }
    },
    [teardown, translateLine]
  );

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
    setLines([]);
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  return { status, lines, targetLanguage, setTargetLanguage, start, stop };
}
