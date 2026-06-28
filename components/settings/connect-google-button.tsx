"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function ConnectGoogleButton({ connected }: { connected: boolean }) {
  return (
    <Button
      variant={connected ? "outline" : "default"}
      onClick={() => signIn("google", { callbackUrl: "/settings" })}
    >
      {connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
    </Button>
  );
}
