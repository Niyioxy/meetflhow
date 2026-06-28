import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const agendaItemTypeEnum = ["update", "discussion", "decision", "action_review"] as const;

const agendaItemSchema = z.object({
  item: z.string(),
  duration_minutes: z.number(),
  notes: z.string(),
  type: z.enum(agendaItemTypeEnum),
});

const agendaSchema = z.object({
  suggested_duration: z.number(),
  agenda_items: z.array(agendaItemSchema),
  pre_meeting_prep: z.array(z.string()),
  goals: z.array(z.string()),
});

export type SuggestedAgenda = z.infer<typeof agendaSchema>;

const SYSTEM_PROMPT = `You are an expert at planning focused, efficient meeting agendas based on a team's history together. Base suggestions strictly on the context provided.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    suggested_duration: { type: Type.NUMBER },
    agenda_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          duration_minutes: { type: Type.NUMBER },
          notes: { type: Type.STRING },
          type: { type: Type.STRING, enum: [...agendaItemTypeEnum] },
        },
        required: ["item", "duration_minutes", "notes", "type"],
      },
    },
    pre_meeting_prep: { type: Type.ARRAY, items: { type: Type.STRING } },
    goals: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["suggested_duration", "agenda_items", "pre_meeting_prep", "goals"],
};

export async function generateAgendaSuggestion(input: {
  title: string;
  attendees: string[];
  pastSummaries: string;
}): Promise<SuggestedAgenda> {
  const prompt = `Based on these past meeting summaries: ${input.pastSummaries}
Upcoming meeting: ${input.title} with attendees: ${input.attendees.join(", ") || "(none listed)"}
Generate a focused agenda. Return JSON:
{
  suggested_duration: number (minutes),
  agenda_items: [
    {
      item: string,
      duration_minutes: number,
      notes: string,
      type: 'update'|'discussion'|'decision'|'action_review'
    }
  ],
  pre_meeting_prep: string[],
  goals: string[]
}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.3,
  });

  return agendaSchema.parse(raw);
}
