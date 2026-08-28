"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";

export function RetryButton({ meetingId }: { meetingId: string }) {
  const t = useTranslations("meetingDetail");
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/retry`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to retry");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
      setRetrying(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
      {retrying ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="mr-2 h-4 w-4" />
      )}
      {t("retryProcessing")}
    </Button>
  );
}
