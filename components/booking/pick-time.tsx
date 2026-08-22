"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";

export function PickTime({ token, proposedSlots }: { token: string; proposedSlots: string[] }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [result, setResult] = useState<{ meetLink: string | null } | "error" | null>(null);

  async function handlePick(slot: string) {
    setConfirming(slot);
    try {
      const res = await fetch(`/api/book/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedSlot: slot }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to confirm");
      }
      const data = await res.json();
      setResult({ meetLink: data.confirmed.meetLink ?? null });
    } catch {
      setResult("error");
    } finally {
      setConfirming(null);
    }
  }

  if (result === "error") {
    return (
      <p className="text-center text-sm text-destructive">
        Something went wrong — that time may no longer be available. Refresh and try again.
      </p>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <Check className="h-8 w-8 text-[var(--green)]" />
        <p className="text-sm font-medium">You&apos;re all set — the meeting is confirmed.</p>
        {result.meetLink && (
          <a
            href={result.meetLink}
            className="text-sm text-primary underline underline-offset-2"
          >
            Join link
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {proposedSlots.map((slot) => (
        <Button
          key={slot}
          type="button"
          variant="outline"
          className="justify-start"
          disabled={confirming !== null}
          onClick={() => handlePick(slot)}
        >
          {confirming === slot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {/* Formatted in the invitee's own browser timezone; server-rendered
              markup would use the server's timezone instead, so this is
              expected to differ between SSR and hydration. */}
          <span suppressHydrationWarning>
            {new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(
              new Date(slot)
            )}
          </span>
        </Button>
      ))}
    </div>
  );
}
