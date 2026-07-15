import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { DashboardNav, MobileNav } from "@/components/dashboard/nav";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { VoiceProfileBanner } from "@/components/dashboard/voice-profile-banner";
import { defaultLocale, isLocale } from "@/i18n/config";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const locale = isLocale(session.user.language) ? session.user.language : defaultLocale;
  const voiceProfile = await db.query.voiceProfiles.findFirst({
    where: (v, { eq }) => eq(v.userId, session.user.id),
  });

  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-[var(--bg-base)]">
        <DashboardNav user={session.user} />
        <MobileNav user={session.user} locale={locale} />
        <DashboardTopbar locale={locale} />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:pl-[calc(15rem+2rem)]">
          {!voiceProfile && (
            <div className="mb-6">
              <VoiceProfileBanner userId={session.user.id} />
            </div>
          )}
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
