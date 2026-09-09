"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMediaRecorder } from "@/hooks/use-media-recorder";

type RecordingContextValue = ReturnType<typeof useMediaRecorder>;

const RecordingContext = createContext<RecordingContextValue | null>(null);

/**
 * Mounted once in the dashboard layout (above the router outlet) rather than
 * inside the /record page itself, so navigating to another page no longer
 * unmounts the MediaRecorder/mic stream and silently kills an in-progress
 * recording — it keeps running until the user stops it or leaves the app.
 */
export function RecordingProvider({ children }: { children: ReactNode }) {
  const recorder = useMediaRecorder();
  return <RecordingContext.Provider value={recorder}>{children}</RecordingContext.Provider>;
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording must be used within a RecordingProvider");
  return ctx;
}
