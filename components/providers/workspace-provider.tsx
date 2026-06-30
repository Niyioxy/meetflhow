"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { WorkspaceSummary } from "@/types/workspace";

const STORAGE_KEY = "meetflow_active_workspace_id";

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceSummary | null;
  loading: boolean;
  setActiveWorkspaceId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: WorkspaceSummary[] = data.workspaces ?? [];
      setWorkspaces(list);

      setActiveWorkspaceIdState((current) => {
        const stored = current ?? localStorage.getItem(STORAGE_KEY);
        if (stored && list.some((w) => w.id === stored)) return stored;
        return list[0]?.id ?? null;
      });
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function setActiveWorkspaceId(id: string | null) {
    setActiveWorkspaceIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, activeWorkspaceId, activeWorkspace, loading, setActiveWorkspaceId, refresh }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
