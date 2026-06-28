import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const sentimentLabelEnum = [
  "very_positive",
  "positive",
  "neutral",
  "tense",
  "negative",
] as const;

const energyEnum = ["high", "medium", "low"] as const;

const segmentSchema = z.object({
  segment: z.number(),
  sentiment: z.enum(sentimentLabelEnum),
  score: z.number(),
  key_moment: z.string(),
  energy: z.enum(energyEnum),
});

const sentimentTimelineSchema = z.object({
  segments: z.array(segmentSchema),
  overall_sentiment: z.string(),
  most_positive_moment: z.string(),
  most_tense_moment: z.string(),
});

export type SentimentTimeline = z.infer<typeof sentimentTimelineSchema>;

const SYSTEM_PROMPT = `You are an expert meeting analyst who tracks emotional tone and energy across a conversation. Base every observation strictly on the transcript content.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          segment: { type: Type.NUMBER },
          sentiment: { type: Type.STRING, enum: [...sentimentLabelEnum] },
          score: { type: Type.NUMBER },
          key_moment: { type: Type.STRING },
          energy: { type: Type.STRING, enum: [...energyEnum] },
        },
        required: ["segment", "sentiment", "score", "key_moment", "energy"],
      },
    },
    overall_sentiment: { type: Type.STRING },
    most_positive_moment: { type: Type.STRING },
    most_tense_moment: { type: Type.STRING },
  },
  required: [
    "segments",
    "overall_sentiment",
    "most_positive_moment",
    "most_tense_moment",
  ],
};

export async function generateSentimentTimeline(
  transcriptText: string
): Promise<SentimentTimeline> {
  const prompt = `Analyse this meeting transcript in 10 equal segments.
Return JSON:
{
  segments: [
    {
      segment: number (1-10),
      sentiment: 'very_positive'|'positive'|'neutral'|'tense'|'negative',
      score: number (-100 to 100),
      key_moment: string (one sentence),
      energy: 'high'|'medium'|'low'
    }
  ],
  overall_sentiment: string,
  most_positive_moment: string,
  most_tense_moment: string
}
Transcript: ${transcriptText}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.2,
  });

  return sentimentTimelineSchema.parse(raw);
}
