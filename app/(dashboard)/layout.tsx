import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardNav, MobileNav } from "@/components/dashboard/nav";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <DashboardNav user={session.user} />
      <MobileNav user={session.user} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:pl-[calc(15rem+2rem)]">
        {children}
      </main>
    </div>
  );
}
