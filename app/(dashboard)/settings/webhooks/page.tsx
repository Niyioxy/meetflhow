import Link from "next/link";
import { WebhookManager } from "@/components/webhooks/webhook-manager";

export default function WebhooksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Send meeting and task events to Zapier or any HTTPS endpoint you control. See the{" "}
          <Link href="/integrations/zapier" className="underline">
            Zapier setup guide
          </Link>{" "}
          for sample payloads.
        </p>
      </div>
      <WebhookManager />
    </div>
  );
}
