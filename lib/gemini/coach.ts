import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const coachSchema = z.object({
  talk_time_ratio: z.number(),
  decision_rate: z.number(),
  clarity_score: z.number(),
  overall_score: z.number(),
  coach_feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type MeetingCoachScore = z.infer<typeof coachSchema>;

const SYSTEM_PROMPT = `You are an expert meeting coach. Analyse meeting transcripts and score them objectively on talk-time balance, decisiveness, and clarity of next steps. Base every score and observation strictly on the transcript content.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    talk_time_ratio: { type: Type.NUMBER },
    decision_rate: { type: Type.NUMBER },
    clarity_score: { type: Type.NUMBER },
    overall_score: { type: Type.NUMBER },
    coach_feedback: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "talk_time_ratio",
    "decision_rate",
    "clarity_score",
    "overall_score",
    "coach_feedback",
    "strengths",
    "improvements",
  ],
};

export async function generateMeetingCoachScore(
  transcriptText: string
): Promise<MeetingCoachScore> {
  const prompt = `Analyse this meeting transcript and return a JSON object:
{
  talk_time_ratio: number (0-100, 100 = perfectly balanced),
  decision_rate: number (0-100, 100 = very decisive),
  clarity_score: number (0-100, 100 = crystal clear next steps),
  overall_score: number (0-100, weighted average),
  coach_feedback: string (2-3 sentences of actionable coaching),
  strengths: string[] (2-3 things done well),
  improvements: string[] (2-3 things to improve)
}
Transcript: ${transcriptText}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.2,
  });

  return coachSchema.parse(raw);
}
