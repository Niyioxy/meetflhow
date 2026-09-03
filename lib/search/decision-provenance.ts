import { db } from "@/db";
import { transcriptChunks, meetings } from "@/db/schema";
import { and, cosineDistance, eq, inArray, lt, ne } from "drizzle-orm";
import { embedQuery } from "@/lib/gemini/embed";
import { gemini } from "@/lib/gemini/client";
import { getAccessibleMeetingIds } from "./ask-meetings";

const TOP_K = 5;

export interface ProvenanceResult {
  narrative: string;
  citations: { meetingId: string; title: string; createdAt: string }[];
}

/**
 * "How did we get here?" for one specific decision — reuses the same
 * embedding index built for "Ask your meetings", but scoped to meetings
 * that happened strictly *before* the one this decision was made in, since
 * a decision's history can't include discussions that came after it.
 */
export async function findDecisionProvenance(
  decisionText: string,
  currentMeetingId: string,
  currentMeetingCreatedAt: Date,
  userId: string
): Promise<ProvenanceResult> {
  const accessibleMeetingIds = (await getAccessibleMeetingIds(userId)).filter(
    (id) => id !== currentMeetingId
  );
  if (accessibleMeetingIds.length === 0) {
    return { narrative: "No earlier meetings to trace this back to.", citations: [] };
  }

  const queryEmbedding = await embedQuery(decisionText);
  const distance = cosineDistance(transcriptChunks.embedding, queryEmbedding);

  const results = await db
    .select({
      content: transcriptChunks.content,
      meetingId: transcriptChunks.meetingId,
      title: meetings.title,
      createdAt: meetings.createdAt,
    })
    .from(transcriptChunks)
    .innerJoin(meetings, eq(transcriptChunks.meetingId, meetings.id))
    .where(
      and(
        inArray(transcriptChunks.meetingId, accessibleMeetingIds),
        ne(transcriptChunks.meetingId, currentMeetingId),
        lt(meetings.createdAt, currentMeetingCreatedAt)
      )
    )
    .orderBy(distance)
    .limit(TOP_K);

  if (results.length === 0) {
    return {
      narrative: "This looks like it was decided fresh here — no related discussion found in earlier meetings.",
      citations: [],
    };
  }

  const context = results
    .map((r, i) => `[${i + 1}] "${r.title}" (${r.createdAt.toISOString().slice(0, 10)}):\n${r.content}`)
    .join("\n\n");

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Decision: ${decisionText}\n\nExcerpts from earlier meetings:\n\n${context}`,
    config: {
      systemInstruction:
        "In 2-4 sentences, explain how the given decision likely came about based ONLY on the " +
        "provided earlier-meeting excerpts — what was discussed, debated, or proposed before it was " +
        "decided. If the excerpts aren't actually related to this decision, say so plainly rather than " +
        "forcing a connection. Refer to meetings by name when relevant.",
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 512 },
    },
  });

  const narrative = response.text;
  if (!narrative) {
    throw new Error("Gemini did not return a narrative");
  }

  const citations = Array.from(
    new Map(
      results.map((r) => [r.meetingId, { meetingId: r.meetingId, title: r.title, createdAt: r.createdAt.toISOString() }])
    ).values()
  );

  return { narrative, citations };
}
