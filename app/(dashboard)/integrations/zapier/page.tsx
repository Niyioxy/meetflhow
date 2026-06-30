import { ZapierGuide } from "@/components/integrations/zapier-guide";

export default function ZapierIntegrationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Zapier</h1>
        <p className="text-sm text-muted-foreground">
          Use MeetFlhow webhooks to trigger Zaps from meeting and task events.
        </p>
      </div>
      <ZapierGuide />
    </div>
  );
}
