import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const followUpEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
  preview_text: z.string(),
});

export type FollowUpEmailContent = z.infer<typeof followUpEmailSchema>;

const SYSTEM_PROMPT = `You are an expert at writing concise, professional meeting follow-up emails. Use only <p>, <ul>, <li>, <strong> tags in the body. Base everything strictly on the meeting context provided.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    preview_text: { type: Type.STRING },
  },
  required: ["subject", "body", "preview_text"],
};

export async function generateFollowUpEmail(input: {
  title: string;
  date: string;
  summary: string;
  decisions: string[];
  actionItems: { task: string; owner: string | null; deadline: string | null }[];
}): Promise<FollowUpEmailContent> {
  const actionItemsText = input.actionItems
    .map(
      (item) =>
        `- ${item.task}${item.owner ? ` (owner: ${item.owner})` : ""}${item.deadline ? ` (due: ${item.deadline})` : ""}`
    )
    .join("\n") || "None";

  const prompt = `Write a professional follow-up email for this meeting.
Title: ${input.title} | Date: ${input.date}
Summary: ${input.summary}
Decisions: ${input.decisions.join("; ") || "None"}
Action items: ${actionItemsText}
Return JSON:
{
  subject: string,
  body: string (HTML using <p><ul><li><strong> only),
  preview_text: string (max 100 chars)
}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.4,
  });

  return followUpEmailSchema.parse(raw);
}
