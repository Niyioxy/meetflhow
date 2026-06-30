"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlackCard } from "@/components/integrations/slack-card";
import { NotionCard } from "@/components/integrations/notion-card";
import {
  IconBrandJira,
  IconBrandChrome,
  IconWebhook,
  IconTimeline,
} from "@tabler/icons-react";
import type { WebhookView } from "@/types/webhooks";

function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Badge variant="secondary">Coming soon</Badge>
        <Button variant="outline" disabled>
          Connect {title}
        </Button>
      </CardContent>
    </Card>
  );
}

export function IntegrationsOverview() {
  const { activeWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const [webhooks, setWebhooks] = useState<WebhookView[] | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setWebhooks(null);
      return;
    }
    fetch(`/api/webhooks?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setWebhooks(data.webhooks ?? []))
      .catch(() => setWebhooks(null));
  }, [activeWorkspaceId]);

  if (!workspaceLoading && !activeWorkspaceId) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Select or create a workspace to manage integrations.
        </CardContent>
      </Card>
    );
  }

  const activeCount = webhooks?.filter((w) => w.is_active).length ?? 0;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <SlackCard />
      <NotionCard />
      <ComingSoonCard
        icon={IconBrandJira}
        title="Jira"
        description="Create Jira tickets directly from action items."
      />
      <ComingSoonCard
        icon={IconTimeline}
        title="Linear"
        description="Create Linear issues directly from action items."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <IconWebhook className="h-6 w-6" />
            <CardTitle>Webhooks</CardTitle>
          </div>
          <CardDescription>
            Send meeting and task events to Zapier or any HTTPS endpoint you control.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Badge variant={activeCount > 0 ? "default" : "secondary"}>
            {webhooks === null ? "—" : `${activeCount} active`}
          </Badge>
          <Button asChild>
            <Link href="/settings/webhooks">Manage Webhooks</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <IconBrandChrome className="h-6 w-6" />
            <CardTitle>Chrome Extension</CardTitle>
          </div>
          <CardDescription>
            Record directly from Google Meet, Microsoft Teams, or Zoom tabs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Badge variant="secondary">Coming soon</Badge>
          <Button variant="outline" disabled>
            Get the Extension
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
