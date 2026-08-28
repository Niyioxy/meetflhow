"use client";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ShareWithWorkspaceToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { workspaces } = useWorkspace();
  if (workspaces.length === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label htmlFor="share-with-workspace" className="text-sm font-normal">
        Share with workspace
      </Label>
      <Switch id="share-with-workspace" checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
