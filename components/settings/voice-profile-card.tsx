import { db } from "@/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreDial } from "@/components/ui/score-dial";
import { VoiceProfileActions } from "@/components/settings/voice-profile-actions";

export async function VoiceProfileCard({ userId }: { userId: string }) {
  const profile = await db.query.voiceProfiles.findFirst({
    where: (v, { eq }) => eq(v.userId, userId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Profile</CardTitle>
        <CardDescription>
          Your voice profile is used only to identify you in meetings you participate in. Delete it
          anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Badge variant={profile ? "default" : "secondary"}>
            {profile
              ? `Enrolled${profile.enrolmentQuality != null ? ` · ${Math.round(profile.enrolmentQuality)}%` : ""}`
              : "Not enrolled"}
          </Badge>
          <VoiceProfileActions enrolled={Boolean(profile)} />
        </div>
        {profile && profile.enrolmentQuality != null && (
          <ScoreDial score={profile.enrolmentQuality} label="Enrolment quality" />
        )}
      </CardContent>
    </Card>
  );
}
