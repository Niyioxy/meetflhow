"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspacePlan } from "@/db/schema";

export function BillingCard({
  workspaceId,
  workspaceName,
  plan,
  isOwner,
}: {
  workspaceId: string;
  /** Shown as the card title (the billing page lists several workspaces). */
  workspaceName?: string;
  plan: WorkspacePlan;
  isOwner: boolean;
}) {
  const [usage, setUsage] = useState<{ count: number; cap: number } | null>(null);
  // null until known. false means this server can't take payments yet.
  const [billingEnabled, setBillingEnabled] = useState<boolean | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (plan !== "free") {
      setUsage(null);
      return;
    }
    fetch(`/api/billing/usage?workspaceId=${workspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setUsage({ count: data.count, cap: data.cap });
        setBillingEnabled(data.billing_enabled !== false);
      })
      .catch(() => setUsage(null));
  }, [workspaceId, plan]);

  async function handleUpgrade() {
    setRedirecting(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to start checkout");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setRedirecting(false);
    }
  }

  async function handleManage() {
    setRedirecting(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to open billing portal");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal");
      setRedirecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{workspaceName ?? "Billing"}</CardTitle>
        <CardDescription>
          {plan === "team"
            ? "This workspace is on the Team plan — unlimited recordings."
            : "Free plan — limited recordings per month. Upgrade for unlimited."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={plan === "team" ? "default" : "secondary"} className="capitalize">
            {plan}
          </Badge>
          {plan === "free" && usage && (
            <span className="text-sm text-muted-foreground">
              {usage.count} / {usage.cap} recordings used this month
            </span>
          )}
        </div>
        {isOwner ? (
          plan === "team" ? (
            <Button variant="outline" onClick={handleManage} disabled={redirecting}>
              {redirecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Manage subscription
            </Button>
          ) : billingEnabled === false ? (
            <span className="max-w-[16rem] text-right text-xs text-muted-foreground">
              Paid plans aren&apos;t open yet. You&apos;re on the Free plan and nothing is charged.
            </span>
          ) : (
            <Button onClick={handleUpgrade} disabled={redirecting}>
              {redirecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upgrade to Team
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">Only the workspace owner can manage billing</span>
        )}
      </CardContent>
    </Card>
  );
}
