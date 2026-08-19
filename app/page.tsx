import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }
  return <LandingPage />;
}
