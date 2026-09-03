import { db } from "@/db";
import { transcriptChunks, meetings } from "@/db/schema";
import { and, cosineDistance, eq, inArray, or } from "drizzle-orm";
import { embedQuery } from "@/lib/gemini/embed";
import { gemini } from "@/lib/gemini/client";

const TOP_K = 8;

export interface AskMeetingsResult {
  answer: string;
  citations: { meetingId: string; title: string; createdAt: string }[];
}

/** Own meetings + workspace-shared meetings the user is a member of — mirrors getMeetingDetail's access rule. */
export async function getAccessibleMeetingIds(userId: string): Promise<string[]> {
  const memberships = await db.query.workspaceMembers.findMany({
    where: (m, { eq }) => eq(m.userId, userId),
    columns: { workspaceId: true },
  });
  const workspaceIds = memberships.map((m) => m.workspaceId);

  const rows = await db.query.meetings.findMany({
    where: (m, { eq: eqCol }) =>
      workspaceIds.length > 0
        ? or(eqCol(m.userId, userId), and(eqCol(m.sharedWithWorkspace, true), inArray(m.workspaceId, workspaceIds)))
        : eqCol(m.userId, userId),
    columns: { id: true },
  });

  return rows.map((r) => r.id);
}

export async function askMeetings(question: string, userId: string): Promise<AskMeetingsResult> {
  const accessibleMeetingIds = await getAccessibleMeetingIds(userId);
  if (accessibleMeetingIds.length === 0) {
    return { answer: "You don't have any meetings yet to search across.", citations: [] };
  }

  const queryEmbedding = await embedQuery(question);
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
    .where(inArray(transcriptChunks.meetingId, accessibleMeetingIds))
    .orderBy(distance)
    .limit(TOP_K);

  if (results.length === 0) {
    return {
      answer: "I couldn't find anything in your meetings related to that.",
      citations: [],
    };
  }

  const context = results
    .map((r, i) => `[${i + 1}] "${r.title}" (${r.createdAt.toISOString().slice(0, 10)}):\n${r.content}`)
    .join("\n\n");

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Question: ${question}\n\nMeeting excerpts:\n\n${context}`,
    config: {
      systemInstruction:
        "You answer questions using ONLY the provided meeting excerpts. If the excerpts don't " +
        "contain enough information to answer the question, say so explicitly rather than guessing " +
        "or using outside knowledge. Refer to meetings by name when relevant. Be concise.",
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 512 },
    },
  });

  const answer = response.text;
  if (!answer) {
    throw new Error("Gemini did not return an answer");
  }

  const citations = Array.from(
    new Map(
      results.map((r) => [r.meetingId, { meetingId: r.meetingId, title: r.title, createdAt: r.createdAt.toISOString() }])
    ).values()
  );

  return { answer, citations };
}
