import { Suspense } from "react";
import { IntegrationsOverview } from "@/components/integrations/integrations-overview";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect MeetFlhow to the tools your team already uses.
        </p>
      </div>
      <Suspense>
        <IntegrationsOverview />
      </Suspense>
    </div>
  );
}
