import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { OnboardingVoiceClient } from "./onboarding-voice-client";

export default async function OnboardingVoicePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Logo size="lg" className="mx-auto mb-2" />
          <CardTitle>Teach MeetFlhow your voice</CardTitle>
          <CardDescription>
            Set up your voice profile so MeetFlhow can recognise you in every meeting automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OnboardingVoiceClient />
          <Link
            href="/dashboard"
            className="text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Skip for now — I&apos;ll set this up later in Settings
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
