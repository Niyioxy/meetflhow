import { db } from "@/db";
import { actionItems } from "@/db/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import type { SpeakerSegment } from "@/types/analysis";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z\s]/g, "");
}

/**
 * Resolves a Gemini-guessed action-item "owner" name against speakers this
 * meeting's voice ID actually verified, turning a loose text guess into a
 * real assigneeUserId. This only trusts identificationMethod "voice_match"
 * (an enrolled user's voice was matched), never "ai_inference" — an
 * AI-guessed speaker label is no more reliable than the AI-guessed owner
 * text it would be "confirming".
 */
function findMatchedUserId(
  ownerName: string,
  recognizedSpeakers: { normalized: string; userId: string }[]
): string | null {
  const ownerNorm = normalizeName(ownerName);
  if (!ownerNorm) return null;

  const exact = recognizedSpeakers.find((s) => s.normalized === ownerNorm);
  if (exact) return exact.userId;

  const ownerWords = ownerNorm.split(/\s+/);
  const byNamePart = recognizedSpeakers.find((s) => {
    const speakerWords = s.normalized.split(/\s+/);
    return ownerWords.some((w) => w.length > 2 && speakerWords.includes(w));
  });
  return byNamePart?.userId ?? null;
}

export async function attributeActionItemsToSpeakers(
  meetingId: string,
  speakerSegments: SpeakerSegment[] | null | undefined
): Promise<number> {
  if (!speakerSegments || speakerSegments.length === 0) return 0;

  const recognizedByUserId = new Map<string, string>();
  for (const segment of speakerSegments) {
    if (segment.identificationMethod === "voice_match" && segment.matchedUserId) {
      recognizedByUserId.set(segment.matchedUserId, segment.speaker);
    }
  }
  if (recognizedByUserId.size === 0) return 0;

  const recognizedSpeakers = Array.from(recognizedByUserId, ([userId, speaker]) => ({
    userId,
    normalized: normalizeName(speaker),
  }));

  const unassigned = await db.query.actionItems.findMany({
    where: and(
      eq(actionItems.meetingId, meetingId),
      isNotNull(actionItems.owner),
      isNull(actionItems.assigneeUserId)
    ),
  });
  if (unassigned.length === 0) return 0;

  let attributed = 0;
  for (const item of unassigned) {
    const userId = findMatchedUserId(item.owner!, recognizedSpeakers);
    if (!userId) continue;
    await db.update(actionItems).set({ assigneeUserId: userId }).where(eq(actionItems.id, item.id));
    attributed++;
  }
  return attributed;
}
