import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamDashboardClient } from "@/components/team/team-dashboard-client";

export default async function TeamPage() {
  const session = await auth();
  if (session?.user.role !== "manager" && session?.user.role !== "admin") {
    redirect("/dashboard");
  }

  return <TeamDashboardClient />;
}
