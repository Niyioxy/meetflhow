"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const DATE_RANGE_OPTIONS = [
  { label: "Next 1 business day", value: 1 },
  { label: "Next 3 business days", value: 3 },
  { label: "Next 5 business days", value: 5 },
  { label: "Next 10 business days", value: 10 },
];

export function BookWithAgentForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [businessDays, setBusinessDays] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !inviteeEmail.trim()) {
      toast.error("Title and invitee email are required");
      return;
    }

    setSubmitting(true);
    try {
      const organizerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          inviteeEmail,
          durationMinutes,
          businessDays,
          organizerTimezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create booking request");
      }

      toast.success(`Invite sent to ${inviteeEmail}`);
      router.push("/calendar");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask an agent to schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="booking-title">Title</Label>
            <Input
              id="booking-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Intro call"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="booking-invitee">Invitee email</Label>
            <Input
              id="booking-invitee"
              type="email"
              value={inviteeEmail}
              onChange={(e) => setInviteeEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Duration</Label>
              <Select
                value={String(durationMinutes)}
                onValueChange={(v) => setDurationMinutes(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Look for a time within</Label>
              <Select
                value={String(businessDays)}
                onValueChange={(v) => setBusinessDays(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            We&apos;ll check your connected calendar (Google or Microsoft) for open slots between
            9am–5pm your time, propose 2-3 of them, and email {inviteeEmail || "the invitee"} a
            link to pick one.
          </p>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send invite
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
