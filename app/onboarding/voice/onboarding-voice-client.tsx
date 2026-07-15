"use client";

import { useRouter } from "next/navigation";
import { EnrolmentFlow } from "@/components/voice-profile/enrolment-flow";

export function OnboardingVoiceClient() {
  const router = useRouter();
  return <EnrolmentFlow mode="enrol" onDone={() => router.push("/dashboard")} />;
}
