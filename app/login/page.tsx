import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "@/components/login-card";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginCard />
    </div>
  );
}
