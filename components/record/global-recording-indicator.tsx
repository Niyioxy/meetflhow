"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRecording } from "@/components/providers/recording-provider";
import { Mic, Square } from "lucide-react";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Surfaces the recording that's still running in the background once the
 * user has navigated away from /record — without this, there's no visible
 * sign the mic is still live, and no way to get back to it or stop it.
 */
export function GlobalRecordingIndicator() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, seconds, stop } = useRecording();

  if (pathname === "/record" || (status !== "recording" && status !== "paused")) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1 rounded-full bg-[#EF4444] py-1.5 pl-4 pr-1.5 text-sm font-medium text-white shadow-lg">
      <button
        type="button"
        onClick={() => router.push("/record")}
        className="flex items-center gap-2"
      >
        <Mic className={status === "recording" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        {status === "recording" ? "Recording" : "Paused"} · {formatTime(seconds)}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          stop();
        }}
        aria-label="Stop recording"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
