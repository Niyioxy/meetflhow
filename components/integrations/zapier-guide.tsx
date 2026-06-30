"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { webhookEventEnum } from "@/db/schema";
import { WEBHOOK_EVENT_LABELS } from "@/types/webhooks";
import { buildSamplePayload } from "@/lib/webhooks-shared";
import type { WebhookView } from "@/types/webhooks";

export function ZapierGuide() {
  const { activeWorkspaceId } = useWorkspace();
  const [webhooks, setWebhooks] = useState<WebhookView[] | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch(`/api/webhooks?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setWebhooks(data.webhooks ?? []))
      .catch(() => setWebhooks([]));
  }, [activeWorkspaceId]);

  const zapierWebhook = webhooks?.find((w) => w.url.includes("zapier.com"));

  async function copyUrl() {
    if (!zapierWebhook) return;
    await navigator.clipboard.writeText(zapierWebhook.url);
    toast.success("Webhook URL copied");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect MeetFlhow to Zapier</CardTitle>
          <CardDescription>
            MeetFlhow sends events to any HTTPS URL via webhooks — Zapier&apos;s &quot;Catch Hook&quot;
            trigger gives you one of those URLs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>1. In Zapier, create a Zap using the &quot;Webhooks by Zapier&quot; trigger and choose &quot;Catch Hook&quot;.</p>
          <p>2. Copy the webhook URL Zapier gives you.</p>
          <p>
            3. Paste it into a new webhook under{" "}
            <Link href="/settings/webhooks" className="underline">
              Settings → Webhooks
            </Link>
            , and select the events you want to send.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your webhook URL</CardTitle>
        </CardHeader>
        <CardContent>
          {webhooks === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : zapierWebhook ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={zapierWebhook.url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Zapier webhook connected yet. Create one in{" "}
              <Link href="/settings/webhooks" className="underline">
                Settings → Webhooks
              </Link>{" "}
              using the Catch Hook URL Zapier gives you.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample payloads</CardTitle>
          <CardDescription>Each event POSTs a JSON body shaped like this.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {webhookEventEnum.map((event) => (
            <div key={event} className="flex flex-col gap-1">
              <p className="text-sm font-medium">{WEBHOOK_EVENT_LABELS[event]}</p>
              <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                {JSON.stringify(
                  { event, data: buildSamplePayload(event), timestamp: "2026-06-30T12:00:00.000Z" },
                  null,
                  2
                )}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
