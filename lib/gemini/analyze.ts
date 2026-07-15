import { z } from "zod";
import { Type } from "@google/genai";
import { gemini } from "./client";
import { priorityEnum, sentimentEnum, type ContentType } from "@/db/schema";

const actionItemSchema = z.object({
  task: z.string(),
  owner: z.string().nullable(),
  deadline: z.string().nullable(),
  priority: z.enum(priorityEnum),
});

const analysisSchema = z.object({
  summary: z.string(),
  actionItems: z.array(actionItemSchema),
  decisions: z.array(z.string()),
  openQuestions: z.array(z.string()),
  highlights: z.array(z.string()),
  sentiment: z.enum(sentimentEnum),
});

export type MeetingAnalysis = z.infer<typeof analysisSchema>;

const SYSTEM_PROMPTS: Record<ContentType, string> = {
  meeting: `You are an expert meeting analyst. Given a raw meeting transcript, extract structured intelligence from it.

Rules:
- summary: 3-5 sentences capturing the purpose, key discussion points, and outcome of the meeting.
- actionItems: every concrete task that someone committed to. "owner" is the person's name if mentioned, otherwise null. "deadline" is a date or relative deadline if mentioned (e.g. "Friday", "next sprint"), otherwise null. "priority" reflects urgency/impact as discussed (high/medium/low).
- decisions: explicit decisions or conclusions the group reached. Empty array if none.
- openQuestions: unresolved questions or topics flagged for follow-up. Empty array if none.
- highlights: always an empty array for meetings — not used.
- sentiment: overall tone of the meeting — "positive" (constructive/upbeat), "neutral" (matter-of-fact), or "tense" (conflict, frustration, disagreement).

Base everything strictly on the transcript content. Do not invent details.`,

  training: `You are an expert training/seminar analyst. Given a raw transcript of a training session or seminar, extract structured intelligence from it.

Rules:
- summary: 3-5 sentences capturing what the session was about and its main outcome.
- actionItems: always an empty array — not used for training sessions.
- decisions: always an empty array — not used for training sessions.
- openQuestions: questions raised during the session (e.g. in Q&A) that were left unresolved, or topics worth exploring further. Empty array if none.
- highlights: the key takeaways and main teaching points from the session, as a list of concise statements. This is the most important field.
- sentiment: overall tone of the session — "positive" (engaging/upbeat), "neutral" (matter-of-fact), or "tense" (confusion, pushback, disagreement).

Base everything strictly on the transcript content. Do not invent details.`,

  sermon: `You are an expert at analyzing sermons and religious teaching. Given a raw transcript of a sermon or message, extract structured intelligence from it.

Rules:
- summary: 3-5 sentences capturing the sermon's central message and theme.
- actionItems: always an empty array — not used for sermons.
- decisions: always an empty array — not used for sermons.
- openQuestions: reflection questions or points raised for further study that the message left open. Empty array if none.
- highlights: the key points and themes of the message, as a list of concise statements. Include scripture references where explicitly mentioned. This is the most important field.
- sentiment: overall tone of the message — "positive" (encouraging/uplifting), "neutral" (matter-of-fact), or "tense" (challenging, confrontational).

Base everything strictly on the transcript content. Do not invent details.`,

  podcast: `You are an expert podcast analyst. Given a raw transcript of a podcast episode, extract structured intelligence from it.

Rules:
- summary: 3-5 sentences capturing what the episode was about.
- actionItems: always an empty array — not used for podcasts.
- decisions: always an empty array — not used for podcasts.
- openQuestions: topics raised but not fully explored, or ideas for follow-up episodes. Empty array if none.
- highlights: the key topics, takeaways, and any notable quotes from the episode, as a list of concise statements. This is the most important field.
- sentiment: overall tone of the episode — "positive" (upbeat/engaging), "neutral" (matter-of-fact), or "tense" (heated debate, disagreement).

Base everything strictly on the transcript content. Do not invent details.`,
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    actionItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING },
          owner: { type: Type.STRING, nullable: true },
          deadline: { type: Type.STRING, nullable: true },
          priority: { type: Type.STRING, enum: [...priorityEnum] },
        },
        required: ["task", "owner", "deadline", "priority"],
      },
    },
    decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
    openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
    sentiment: { type: Type.STRING, enum: [...sentimentEnum] },
  },
  required: ["summary", "actionItems", "decisions", "openQuestions", "highlights", "sentiment"],
};

export async function analyzeTranscript(
  transcriptText: string,
  contentType: ContentType = "meeting"
): Promise<MeetingAnalysis> {
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: transcriptText,
    config: {
      systemInstruction: SYSTEM_PROMPTS[contentType] ?? SYSTEM_PROMPTS.meeting,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini did not return an analysis");
  }

  return analysisSchema.parse(JSON.parse(text));
}
