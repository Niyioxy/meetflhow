"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function ConnectMicrosoftButton({ connected }: { connected: boolean }) {
  return (
    <Button
      variant={connected ? "outline" : "default"}
      onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/settings" })}
    >
      {connected ? "Reconnect Microsoft Teams" : "Connect Microsoft Teams"}
    </Button>
  );
}
