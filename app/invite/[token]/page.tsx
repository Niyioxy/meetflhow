import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getInvitePreview } from "@/lib/workspaces";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { AcceptInviteButton } from "@/components/workspace/accept-invite-button";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${params.token}`)}`);
  }

  let invite;
  try {
    invite = await getInvitePreview(params.token);
  } catch {
    invite = null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Logo size="lg" className="mx-auto mb-2" />
          {invite ? (
            <CardDescription>
              {invite.inviter_name ?? "Someone"} invited you to join{" "}
              <strong className="text-foreground">{invite.workspace_name}</strong> as a{" "}
              {invite.role}.
            </CardDescription>
          ) : (
            <CardDescription>This invite link is invalid.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {invite?.already_accepted ? (
            <p className="text-center text-sm text-muted-foreground">
              This invite has already been accepted.
            </p>
          ) : invite?.expired ? (
            <p className="text-center text-sm text-muted-foreground">This invite has expired.</p>
          ) : invite ? (
            <AcceptInviteButton token={params.token} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = { title: "Accept invite — MeetFlhow" };
