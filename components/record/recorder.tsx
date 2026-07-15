"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { Waveform } from "@/components/record/waveform";
import { LiveCaptions } from "@/components/record/live-captions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformSelect } from "@/components/upload/platform-select";
import { ContentTypeSelect } from "@/components/upload/content-type-select";
import { cn } from "@/lib/utils";
import { Mic, Pause, Play, Square, Download, Loader2, Sparkles, RotateCcw } from "lucide-react";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function Recorder({
  initialTitle,
  initialPlatform,
}: {
  initialTitle?: string;
  initialPlatform?: string;
} = {}) {
  const router = useRouter();
  const { status, seconds, audioBlob, stream, error, start, pause, resume, stop, reset } =
    useMediaRecorder();

  const [title, setTitle] = useState(initialTitle ?? "");
  const [platform, setPlatform] = useState(initialPlatform ?? "in-person");
  const [contentType, setContentType] = useState("meeting");
  const [submitting, setSubmitting] = useState(false);

  const audioUrl = useMemo(() => (audioBlob ? URL.createObjectURL(audioBlob) : null), [audioBlob]);

  function handleDownload() {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${title || "meetflhow-recording"}.webm`;
    a.click();
  }

  async function handleUpload() {
    if (!audioBlob) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, `${title || "recording"}.webm`);
      formData.append("title", title || "Recorded meeting");
      formData.append("platform", platform);
      formData.append("contentType", contentType);

      const res = await fetch("/api/meetings/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      toast.success("Recording processed");
      router.push(`/meetings/${data.meetingId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCircleClick() {
    if (status === "idle") start();
    else if (status === "recording") stop();
    else if (status === "paused") resume();
  }

  const isRecording = status === "recording";
  const isPaused = status === "paused";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a meeting</CardTitle>
        <CardDescription>
          Records mic audio in your browser. Nothing leaves your device until you upload it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-[var(--bg-surface)] py-12">
          <button
            type="button"
            onClick={handleCircleClick}
            aria-label={isRecording ? "Stop recording" : isPaused ? "Resume recording" : "Start recording"}
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full transition-colors duration-200",
              isRecording
                ? "animate-pulse-glow-red bg-[radial-gradient(circle,#EF4444,#B91C1C)]"
                : "animate-pulse-glow bg-[radial-gradient(circle,var(--blue-primary),#1D4ED8)]",
              isPaused && "animate-none opacity-80"
            )}
          >
            <Mic className="h-8 w-8 text-white" />
          </button>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {status === "idle" && "Click to record"}
            {isRecording && `Recording... ${formatTime(seconds)}`}
            {isPaused && `Paused... ${formatTime(seconds)}`}
            {status === "stopped" && "Recording complete"}
          </p>

          {isRecording && <Waveform stream={stream} active={isRecording} />}

          {(isRecording || isPaused) && (
            <div className="flex gap-2">
              {isRecording ? (
                <Button variant="outline" size="sm" onClick={pause}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={resume}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={stop}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </div>
          )}

          {status === "stopped" && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Record again
            </Button>
          )}

          <LiveCaptions stream={stream} active={isRecording} />
        </div>

        {status === "stopped" && audioUrl && (
          <div className="flex flex-col gap-4">
            <audio controls src={audioUrl} className="w-full" />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-title">Title</Label>
                <Input
                  id="rec-title"
                  placeholder="Recorded meeting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Platform</Label>
                <PlatformSelect value={platform} onChange={setPlatform} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Content type</Label>
                <ContentTypeSelect value={contentType} onChange={setContentType} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={handleUpload} disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transcribing & analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upload & analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
