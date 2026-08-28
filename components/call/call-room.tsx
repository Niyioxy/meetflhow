"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2, Radio } from "lucide-react";

interface Participant {
  sessionId: string;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
}

type CallStatus = "connecting" | "in-call" | "ended" | "error";

export function CallRoom({ callRoomId }: { callRoomId: string }) {
  const router = useRouter();
  const callRef = useRef<DailyCall | null>(null);
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function syncParticipants(call: DailyCall) {
      const all = call.participants();
      setParticipants(
        Object.values(all).map((p) => ({
          sessionId: p.session_id,
          name: p.user_name || "Someone",
          isLocal: p.local,
          isMuted: !p.audio,
          isSpeaking: p.session_id === activeSpeakerId,
        }))
      );
    }

    async function start() {
      try {
        const res = await fetch(`/api/calls/${callRoomId}/token`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to join call");
        if (cancelled) return;

        setIsOwner(Boolean(data.isOwner));

        const call = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: false,
        });
        callRef.current = call;

        call
          .on("joined-meeting", () => {
            setStatus("in-call");
            syncParticipants(call);
          })
          .on("participant-joined", () => syncParticipants(call))
          .on("participant-updated", () => syncParticipants(call))
          .on("participant-left", () => {
            syncParticipants(call);
            const remaining = Object.keys(call.participants()).length;
            if (remaining <= 1) {
              endCall();
            }
          })
          .on("active-speaker-change", (e) => {
            setActiveSpeakerId(e?.activeSpeaker?.peerId ?? null);
          })
          .on("error", (e) => {
            console.error("Daily call error", e);
            setStatus("error");
          });

        await call.join({ url: data.roomUrl, token: data.token });
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to join call");
        setStatus("error");
      }
    }

    start();

    return () => {
      cancelled = true;
      callRef.current?.leave().catch(() => {});
      callRef.current?.destroy().catch(() => {});
      callRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callRoomId]);

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    const next = !muted;
    call.setLocalAudio(!next);
    setMuted(next);
  }

  async function leaveCall() {
    await callRef.current?.leave().catch(() => {});
    router.push("/dashboard");
  }

  async function endCall() {
    setStatus("ended");
    await fetch(`/api/calls/${callRoomId}/end`, { method: "POST" }).catch(() => {});
    await callRef.current?.leave().catch(() => {});
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[var(--red)]" />
            <CardTitle>MeetFlhow call</CardTitle>
          </div>
          <CardDescription>
            {status === "connecting" && "Connecting…"}
            {status === "in-call" && "Recording — this call will be transcribed and analyzed automatically."}
            {status === "ended" && "Call ended."}
            {status === "error" && "Something went wrong."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {status === "connecting" && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === "in-call" && (
            <>
              <div className="flex flex-col gap-2">
                {participants.map((p) => (
                  <div
                    key={p.sessionId}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-[var(--bg-surface)] px-3 py-2"
                  >
                    <span className="text-sm font-medium">
                      {p.name}
                      {p.isLocal && " (you)"}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.isSpeaking && <span className="h-2 w-2 rounded-full bg-[var(--green)]" />}
                      {p.isMuted ? (
                        <MicOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mic className="h-4 w-4 text-[var(--blue-light)]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="lg" onClick={toggleMute}>
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button variant="destructive" size="lg" onClick={leaveCall}>
                  <PhoneOff className="mr-2 h-5 w-5" />
                  Leave
                </Button>
              </div>

              {isOwner && (
                <Button variant="ghost" size="sm" onClick={endCall} className="text-muted-foreground">
                  End call for everyone
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
