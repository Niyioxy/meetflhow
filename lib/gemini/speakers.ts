import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";

const speakerSegmentSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  timestamp_approx: z.string(),
});

export type SpeakerSegment = z.infer<typeof speakerSegmentSchema>;

const SYSTEM_PROMPT = `You are an expert at reconstructing speaker turns in a meeting transcript using context clues, question/answer patterns, and conversational flow. Use "Unknown" when a speaker cannot be identified. Base everything strictly on the transcript content.`;

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      speaker: { type: Type.STRING },
      text: { type: Type.STRING },
      timestamp_approx: { type: Type.STRING },
    },
    required: ["speaker", "text", "timestamp_approx"],
  },
};

export async function identifySpeakers(
  transcriptText: string,
  attendees: string[]
): Promise<SpeakerSegment[]> {
  const prompt = `Meeting transcript: ${transcriptText}
Attendees: ${attendees.length > 0 ? attendees.join(", ") : "(not provided)"}
Identify who is speaking each line using context clues,
question/answer patterns, conversational flow.
Return a JSON array:
[
  {
    speaker: string,
    text: string,
    timestamp_approx: string
  }
]
Use 'Unknown' if speaker cannot be identified.`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.2,
  });

  return z.array(speakerSegmentSchema).parse(raw);
}
