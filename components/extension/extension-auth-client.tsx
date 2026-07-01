"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

declare const chrome: {
  runtime: { sendMessage: (extensionId: string, message: object, callback?: (response: unknown) => void) => void };
};

export function ExtensionAuthClient({
  token,
  extensionId,
  userEmail,
}: {
  token: string;
  extensionId: string | null;
  userEmail: string;
}) {
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!extensionId) return;
    try {
      chrome.runtime.sendMessage(
        extensionId,
        { type: "AUTH_TOKEN", token, email: userEmail },
        () => { setSent(true); }
      );
    } catch {
      // Extension not installed or externally_connectable not configured — fall back to copy
    }
  }, [extensionId, token, userEmail]);

  async function handleCopy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb] text-white font-bold text-lg">
            M
          </div>
          <div>
            <h1 className="text-lg font-semibold">MeetFlhow Extension</h1>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="font-medium">Extension connected!</p>
            <p className="text-sm text-muted-foreground">
              You can close this tab and return to your meeting.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">
              {extensionId
                ? "Almost there — if the extension wasn't connected automatically, copy the token below and paste it into the extension popup."
                : "Copy this token and paste it into the MeetFlhow extension popup."}
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                API Token
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs">
                  {token}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This token gives the extension access to upload recordings on your behalf. Keep it private.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <a href="/dashboard" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open Dashboard
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
