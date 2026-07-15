import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { isCalendarConnected } from "@/lib/google/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectGoogleButton } from "@/components/settings/connect-google-button";
import { VoiceProfileCard } from "@/components/settings/voice-profile-card";

export default async function SettingsPage() {
  const session = await auth();
  const user = session!.user;
  const connected = await isCalendarConnected(user.id);
  const t = await getTranslations("settings");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>{(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspace")}</CardTitle>
          <CardDescription>{t("workspaceDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/settings/workspace">{t("manageWorkspace")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("integrations")}</CardTitle>
          <CardDescription>{t("integrationsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/settings/integrations">{t("manageIntegrations")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("googleCalendar")}</CardTitle>
          <CardDescription>{t("googleCalendarDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? t("connected") : t("notConnected")}
          </Badge>
          <ConnectGoogleButton connected={connected} />
        </CardContent>
      </Card>

      <VoiceProfileCard userId={user.id} />

      <Card>
        <CardHeader>
          <CardTitle>{t("account")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" type="submit">
              {t("signOut")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
