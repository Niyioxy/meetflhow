import { getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { Mail } from "lucide-react";

export default async function CheckEmailPage() {
  const t = await getTranslations("login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <Logo size="lg" className="mx-auto mb-2" />
          <Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <CardTitle>{t("checkEmailTitle")}</CardTitle>
          <CardDescription>{t("checkEmailDescription")}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
