"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Mic, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScoreDial } from "@/components/ui/score-dial";
import { useMediaRecorder } from "@/hooks/use-media-recorder";

const READING_PASSAGE = `The best meetings start with a clear goal. Before you dive in, ask yourself: what decision needs to be made here, and who needs to be in the room? Sometimes the answer is nobody — a quick message would do just fine. But when a real conversation is needed, a little structure goes a long way. Share an agenda ahead of time, keep the room focused, and end with a clear summary of what was decided and who's doing what next. It sounds simple, but it's the difference between a meeting that moves things forward and one that just eats up everyone's afternoon.`;

const RECORDING_SECONDS = 30;

type Phase = "intro" | "recording" | "uploading" | "success" | "retry" | "error";

export function EnrolmentFlow({
  mode = "enrol",
  onDone,
}: {
  mode?: "enrol" | "re-enrol";
  onDone?: () => void;
}) {
  const { status, seconds, audioBlob, error: recorderError, start, stop } = useMediaRecorder();
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [quality, setQuality] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleStart() {
    setApiError(null);
    setPhase("recording");
    await start();
  }

  async function handleStop() {
    stop();
  }

  async function upload(blob: Blob) {
    setPhase("uploading");
    setApiError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "voice-enrolment.webm");
      formData.append("consent", "true");
      formData.append("durationSeconds", String(seconds));
      const res = await fetch(mode === "enrol" ? "/api/voice-profile/enrol" : "/api/voice-profile/re-enrol", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Something went wrong");
        setPhase("error");
        return;
      }
      if (data.status === "retry") {
        setQuality(data.quality ?? 0);
        setPhase("retry");
        return;
      }
      setQuality(data.quality ?? 100);
      setPhase("success");
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    } catch {
      setApiError("Failed to upload recording");
      setPhase("error");
    }
  }

  function retry() {
    setPhase("intro");
    setQuality(null);
    setApiError(null);
  }

  useEffect(() => {
    if (audioBlob && phase === "recording") {
      upload(audioBlob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob]);

  if (phase === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-[#10B981]" />
        <p className="text-lg font-semibold">Voice profile created</p>
        {quality !== null && <ScoreDial score={quality} label="Enrolment quality" />}
        <p className="text-sm text-muted-foreground">
          MeetFlhow will now recognise your voice in meetings automatically.
        </p>
        {onDone && (
          <Button onClick={onDone} className="mt-2">
            Done
          </Button>
        )}
      </div>
    );
  }

  if (phase === "retry") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-lg font-semibold">Let&apos;s try that again</p>
        <p className="text-sm text-muted-foreground">
          Recordings need to be at least 15 seconds — try again and read a bit more of the passage.
        </p>
        <Button onClick={retry} className="mt-2">
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Analyzing your voice...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-sm text-[var(--red)]">{apiError}</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Read the passage below aloud</p>
        <p className="text-xs text-muted-foreground">
          This helps MeetFlhow recognise you in every meeting. It takes about {RECORDING_SECONDS} seconds.
        </p>
      </div>

      <div className="rounded-md bg-muted/30 p-4 text-sm leading-relaxed">{READING_PASSAGE}</div>

      {status !== "recording" && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
          <span className="text-muted-foreground">
            I consent to MeetFlhow storing my voice profile for speaker identification.
          </span>
        </label>
      )}

      {recorderError && <p className="text-sm text-[var(--red)]">{recorderError}</p>}

      {status === "recording" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute h-24 w-24 -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border-light)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="var(--blue-primary, #2563EB)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - Math.min(seconds / RECORDING_SECONDS, 1))}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <Mic className="h-8 w-8 animate-pulse text-[var(--blue-primary,#2563EB)]" />
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            {seconds}s / {RECORDING_SECONDS}s
          </p>
          <Button onClick={handleStop} variant="outline">
            Stop recording
          </Button>
        </div>
      ) : (
        <Button onClick={handleStart} disabled={!consent} className="w-full">
          <Mic className="mr-1.5 h-4 w-4" />
          Start recording
        </Button>
      )}
    </div>
  );
}
