"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShareLinkView } from "@/types/share";

export function ShareModal({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<ShareLinkView | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/meetings/${meetingId}/share`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setShare(data.share))
      .catch(() => toast.error("Failed to load share settings"))
      .finally(() => setLoading(false));
  }, [open, meetingId]);

  async function ensureShare() {
    if (share) return share;
    return updateShare({});
  }

  async function updateShare(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShare(data.share);
      return data.share as ShareLinkView;
    } catch {
      toast.error("Failed to update share link");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    await updateShare({});
  }

  async function handleToggle(key: keyof ShareLinkView, value: boolean) {
    await ensureShare();
    await updateShare({ [key]: value });
  }

  async function handleSetPassword() {
    if (!password) return;
    await ensureShare();
    await updateShare({ password });
    setPassword("");
  }

  async function handleRemovePassword() {
    await updateShare({ password: null });
  }

  async function handleExpiry(days: 7 | 30 | 0) {
    await ensureShare();
    await updateShare({ expires_in_days: days });
  }

  async function handleRevoke() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setShare(null);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke share link");
    } finally {
      setSaving(false);
    }
  }

  function shareUrl(token: string) {
    return `${window.location.origin}/share/${token}`;
  }

  async function handleCopy() {
    if (!share) return;
    await navigator.clipboard.writeText(shareUrl(share.token));
    toast.success("Link copied to clipboard");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        🔗 Share
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share meeting summary</DialogTitle>
          <DialogDescription>Anyone with the link can view, no account required.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : !share ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground">No share link yet for this meeting.</p>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create share link
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl(share.token)} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                Copy
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {(
                [
                  ["show_transcript", "Show transcript"],
                  ["show_action_items", "Show action items"],
                  ["show_cost", "Show meeting cost"],
                  ["show_score", "Show meeting score"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="text-sm font-normal">
                    {label}
                  </Label>
                  <Switch
                    id={key}
                    checked={share[key]}
                    disabled={saving}
                    onCheckedChange={(value) => handleToggle(key, value)}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Label className="text-sm font-normal">Password protection</Label>
              {share.has_password ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Password is set</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleRemovePassword} disabled={saving}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    placeholder="Set a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleSetPassword} disabled={saving || !password}>
                    Set
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Label className="text-sm font-normal">Expiry</Label>
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
                {(
                  [
                    [7, "7 days"],
                    [30, "30 days"],
                    [0, "Never"],
                  ] as const
                ).map(([days, label]) => (
                  <Button
                    key={days}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 flex-1 rounded-full px-3 text-xs"
                    disabled={saving}
                    onClick={() => handleExpiry(days)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {share.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(share.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Viewed {share.view_count} {share.view_count === 1 ? "time" : "times"}
            </p>
          </div>
        )}

        {share && (
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={handleRevoke} disabled={saving}>
              Revoke link
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
