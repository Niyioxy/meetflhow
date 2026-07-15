import { db } from "@/db";
import { voiceProfiles } from "@/db/schema";
import { getEmbedding } from "@/lib/voice";
import { eq } from "drizzle-orm";

const MIN_ENROLMENT_SECONDS = 15;
const TARGET_ENROLMENT_SECONDS = 30;

export async function getVoiceProfile(userId: string) {
  return db.query.voiceProfiles.findFirst({
    where: (v, { eq: eqOp }) => eqOp(v.userId, userId),
  });
}

export async function upsertVoiceProfile(
  userId: string,
  data: { embedding: number[]; quality: number; sampleDurationSeconds: number; consentAt: Date }
) {
  const [row] = await db
    .insert(voiceProfiles)
    .values({
      userId,
      embedding: data.embedding,
      enrolmentQuality: data.quality,
      sampleDurationSeconds: data.sampleDurationSeconds,
      consentAt: data.consentAt,
    })
    .onConflictDoUpdate({
      target: voiceProfiles.userId,
      set: {
        embedding: data.embedding,
        enrolmentQuality: data.quality,
        sampleDurationSeconds: data.sampleDurationSeconds,
        consentAt: data.consentAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/** Runs a raw uploaded recording through the voice-service to get its speaker embedding. */
export async function enrolFromAudio(
  audioBuffer: Buffer,
  durationSeconds: number
): Promise<{ embedding: number[] | null; quality: number }> {
  if (durationSeconds < MIN_ENROLMENT_SECONDS) {
    return { embedding: null, quality: Math.round((durationSeconds / TARGET_ENROLMENT_SECONDS) * 100) };
  }
  const embedding = await getEmbedding(audioBuffer);
  const quality = Math.min(100, Math.round((durationSeconds / TARGET_ENROLMENT_SECONDS) * 100));
  return { embedding, quality };
}

/** Enrols a voice profile from an audio buffer and, if long enough, saves it. */
export async function enrolAndSave(
  userId: string,
  audioBuffer: Buffer,
  durationSeconds: number,
  consentAt: Date
) {
  const { embedding, quality } = await enrolFromAudio(audioBuffer, durationSeconds);
  if (!embedding) {
    return { status: "retry" as const, quality };
  }
  await upsertVoiceProfile(userId, { embedding, quality, sampleDurationSeconds: durationSeconds, consentAt });
  return { status: "ok" as const, quality };
}

export async function deleteVoiceProfile(userId: string) {
  await db.delete(voiceProfiles).where(eq(voiceProfiles.userId, userId));
}

/**
 * Resolves the set of candidate users whose voice profiles are eligible to be
 * matched against a given meeting: the meeting owner, plus (if the meeting
 * belongs to a workspace) every member of that workspace. Profiles are never
 * loaded outside this set, so voice matching never crosses workspaces.
 */
export async function getCandidateProfiles(meeting: { userId: string; workspaceId: string | null }) {
  const candidateUserIds = new Set<string>([meeting.userId]);

  if (meeting.workspaceId) {
    const members = await db.query.workspaceMembers.findMany({
      where: (m, { eq: eqOp }) => eqOp(m.workspaceId, meeting.workspaceId!),
    });
    for (const member of members) candidateUserIds.add(member.userId);
  }

  const rows = await db.query.voiceProfiles.findMany({
    where: (v, { inArray }) => inArray(v.userId, Array.from(candidateUserIds)),
    with: { user: true },
  });

  return rows.map((row) => ({
    userId: row.userId,
    name: row.user.name ?? row.user.email,
    embedding: row.embedding,
  }));
}
