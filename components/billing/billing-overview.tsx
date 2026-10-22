"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BillingCard } from "@/components/workspace/billing-card";
import { useWorkspace } from "@/components/providers/workspace-provider";

// After checkout the plan flips when Polar's webhook reaches us, which can lag
// the redirect by a few seconds. Re-check a handful of times before giving up.
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 6;

function CreateWorkspaceCard() {
  const { refresh, setActiveWorkspaceId } = useWorkspace();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), organizationType: "general" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await refresh();
      setActiveWorkspaceId(data.workspace.id);
      toast.success(`${data.workspace.name} created`);
      setName("");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start with a workspace</CardTitle>
        <CardDescription>
          Plans are per workspace: a workspace holds your team&apos;s meetings and members, and it
          is what you upgrade. Create one to see its plan and upgrade when you need to.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            placeholder="e.g. Acme team"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
          />
        </div>
        <Button onClick={handleCreate} disabled={creating || !name.trim()}>
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create workspace
        </Button>
      </CardContent>
    </Card>
  );
}

export function BillingOverview() {
  const { workspaces, loading, refresh } = useWorkspace();
  const searchParams = useSearchParams();
  const result = searchParams.get("billing");
  const polls = useRef(0);
  const [waitingForPlan, setWaitingForPlan] = useState(result === "success");

  useEffect(() => {
    if (result === "cancelled") toast("Checkout cancelled — nothing was charged");
    if (result === "success") toast.success("Payment received — activating your plan…");
  }, [result]);

  const anyTeam = workspaces.some((workspace) => workspace.plan === "team");

  useEffect(() => {
    if (!waitingForPlan) return;
    if (anyTeam) {
      setWaitingForPlan(false);
      toast.success("Your workspace is now on the Team plan");
      return;
    }
    if (polls.current >= MAX_POLLS) {
      setWaitingForPlan(false);
      toast("Still activating — refresh in a minute if your plan hasn't changed");
      return;
    }
    const timer = setTimeout(() => {
      polls.current += 1;
      refresh();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [waitingForPlan, anyTeam, refresh, workspaces]);

  if (loading && workspaces.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your plans…
      </div>
    );
  }

  if (workspaces.length === 0) return <CreateWorkspaceCard />;

  return (
    <div className="flex flex-col gap-4">
      {workspaces.map((workspace) => (
        <BillingCard
          key={workspace.id}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          plan={workspace.plan}
          isOwner={workspace.role === "owner"}
        />
      ))}
      <p className="text-sm text-muted-foreground">
        Free includes a monthly recording allowance per workspace; Team removes the limit.{" "}
        <Link href="/#pricing" className="text-foreground underline underline-offset-2">
          See plan details
        </Link>
        .
      </p>
    </div>
  );
}
