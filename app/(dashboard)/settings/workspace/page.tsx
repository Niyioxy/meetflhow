import { WorkspaceSettings } from "@/components/workspace/workspace-settings";

export default function WorkspaceSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-muted-foreground">Manage members, roles, and invites.</p>
      </div>
      <WorkspaceSettings />
    </div>
  );
}
