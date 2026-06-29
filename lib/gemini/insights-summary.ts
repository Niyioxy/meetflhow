import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const insightCardTypeEnum = ["warning", "tip", "win"] as const;

const insightCardSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(insightCardTypeEnum),
});

const insightsSummarySchema = z.object({
  headline: z.string(),
  insights: z.array(insightCardSchema),
  recommendation: z.string(),
});

export type InsightsSummaryResult = z.infer<typeof insightsSummarySchema>;

const SYSTEM_PROMPT = `You are an expert meeting analyst providing actionable insights based on aggregated statistics. Base everything strictly on the provided stats — do not invent details.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          type: { type: Type.STRING, enum: [...insightCardTypeEnum] },
        },
        required: ["title", "description", "type"],
      },
    },
    recommendation: { type: Type.STRING },
  },
  required: ["headline", "insights", "recommendation"],
};

export async function generateInsightsSummary(statsJson: string): Promise<InsightsSummaryResult> {
  const prompt = `Based on these meeting statistics: ${statsJson}
Generate actionable insights. Return JSON:
{
  headline: string (one punchy insight),
  insights: [{ title, description, type: 'warning'|'tip'|'win' }],
  recommendation: string
}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.4,
  });

  return insightsSummarySchema.parse(raw);
}
