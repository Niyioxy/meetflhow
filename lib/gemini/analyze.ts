import { z } from "zod";
import { Type } from "@google/genai";
import { gemini } from "./client";
import { priorityEnum, sentimentEnum } from "@/db/schema";

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
  sentiment: z.enum(sentimentEnum),
});

export type MeetingAnalysis = z.infer<typeof analysisSchema>;

const SYSTEM_PROMPT = `You are an expert meeting analyst. Given a raw meeting transcript, extract structured intelligence from it.

Rules:
- summary: 3-5 sentences capturing the purpose, key discussion points, and outcome of the meeting.
- actionItems: every concrete task that someone committed to. "owner" is the person's name if mentioned, otherwise null. "deadline" is a date or relative deadline if mentioned (e.g. "Friday", "next sprint"), otherwise null. "priority" reflects urgency/impact as discussed (high/medium/low).
- decisions: explicit decisions or conclusions the group reached. Empty array if none.
- openQuestions: unresolved questions or topics flagged for follow-up. Empty array if none.
- sentiment: overall tone of the meeting — "positive" (constructive/upbeat), "neutral" (matter-of-fact), or "tense" (conflict, frustration, disagreement).

Base everything strictly on the transcript content. Do not invent details.`;

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
    sentiment: { type: Type.STRING, enum: [...sentimentEnum] },
  },
  required: ["summary", "actionItems", "decisions", "openQuestions", "sentiment"],
};

export async function analyzeTranscript(
  transcriptText: string
): Promise<MeetingAnalysis> {
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: transcriptText,
    config: {
      systemInstruction: SYSTEM_PROMPT,
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
