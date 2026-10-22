import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "@/components/login-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  // Only same-origin paths — "//evil.com" or "/\evil.com" would otherwise
  // turn the server-side redirect below into an open redirect.
  const requested = searchParams.callbackUrl;
  const callbackUrl =
    requested && /^\/(?![/\\])/.test(requested) ? requested : "/dashboard";

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
