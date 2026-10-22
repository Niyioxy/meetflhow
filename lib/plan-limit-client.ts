import { toast } from "sonner";

// Client-side half of the free-plan limit: the API replies 403 with
// `code: "plan_limit"` (see PLAN_LIMIT_CODE in lib/billing.ts), and the UI turns
// that into a toast with an Upgrade button instead of a dead-end message.

export class PlanLimitError extends Error {}

/** Builds the error to throw for a failed API response. */
export function apiError(data: { error?: string; code?: string } | null, fallback: string): Error {
  const message = data?.error || fallback;
  return data?.code === "plan_limit" ? new PlanLimitError(message) : new Error(message);
}

/** Shows an error toast; a plan-limit error gets an Upgrade action. */
export function toastApiError(error: unknown, navigate: (href: string) => void, prefix = ""): void {
  const message = error instanceof Error ? error.message : "Something went wrong";
  if (error instanceof PlanLimitError) {
    toast.error(`${prefix}${message}`, {
      duration: 12000,
      action: { label: "Upgrade", onClick: () => navigate("/billing") },
    });
    return;
  }
  toast.error(error instanceof Error ? `${prefix}${message}` : prefix ? prefix.replace(/:\s*$/, "") : message);
}
