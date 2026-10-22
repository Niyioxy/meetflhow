import { Suspense } from "react";
import type { Metadata } from "next";
import { BillingOverview } from "@/components/billing/billing-overview";

export const metadata: Metadata = {
  title: "Plan & billing — MeetFlhow",
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan &amp; billing</h1>
        <p className="text-sm text-muted-foreground">
          See each workspace&apos;s plan and upgrade or manage your subscription.
        </p>
      </div>
      <Suspense>
        <BillingOverview />
      </Suspense>
    </div>
  );
}
