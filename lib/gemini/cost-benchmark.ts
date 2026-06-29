import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const verdictEnum = ["high_value", "acceptable", "expensive", "wasteful"] as const;

const costVerdictSchema = z.object({
  verdict: z.enum(verdictEnum),
  reasoning: z.string(),
  suggestion: z.string(),
});

export type CostVerdictResult = z.infer<typeof costVerdictSchema>;

const SYSTEM_PROMPT = `You are an expert at evaluating whether a meeting's cost was justified by its outcomes. Base your judgment strictly on what's provided — do not invent details.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    verdict: { type: Type.STRING, enum: [...verdictEnum] },
    reasoning: { type: Type.STRING },
    suggestion: { type: Type.STRING },
  },
  required: ["verdict", "reasoning", "suggestion"],
};

export async function generateCostVerdict(input: {
  title: string;
  totalCost: number;
  currency: string;
  durationMinutes: number;
  summary: string | null;
  decisionsCount: number;
  actionItemsCount: number;
}): Promise<CostVerdictResult> {
  const prompt = `Meeting: ${input.title}
Cost: ${input.currency} ${input.totalCost} for ${input.durationMinutes} minutes
Summary: ${input.summary ?? "Not yet analyzed"}
Decisions made: ${input.decisionsCount}
Action items created: ${input.actionItemsCount}

Was this meeting worth the cost? Return JSON:
{ verdict: 'high_value'|'acceptable'|'expensive'|'wasteful',
  reasoning: string,
  suggestion: string }`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.3,
  });

  return costVerdictSchema.parse(raw);
}
