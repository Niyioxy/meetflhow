import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "@/components/login-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const callbackUrl = searchParams.callbackUrl || "/dashboard";

  const session = await auth();
  if (session) {
    redirect(callbackUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginCard callbackUrl={callbackUrl} />
    </div>
  );
}
