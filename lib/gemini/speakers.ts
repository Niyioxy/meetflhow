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

const labelNameSchema = z.record(z.string(), z.string());

const LABEL_SYSTEM_PROMPT = `You are an expert at figuring out who is speaking in a meeting transcript that has already been split into speaker labels (e.g. "Speaker 0", "Speaker 1"). For each label, use the sample lines and the attendee list to guess a real display name. Use "Unknown Speaker N" (keeping the original label) when you can't tell.`;

/**
 * Given a few representative utterance samples per already-diarized speaker
 * label, guesses a real display name for each. Used only for labels that
 * couldn't be matched by voice, so it's a much smaller/cheaper ask than
 * reconstructing the whole transcript.
 */
export async function nameSpeakerLabels(
  labelSamples: { label: string; samples: string[] }[],
  attendees: string[]
): Promise<Record<string, string>> {
  if (labelSamples.length === 0) return {};

  const prompt = `Speaker labels with sample lines from a meeting transcript:
${labelSamples
  .map((l) => `${l.label}:\n${l.samples.map((s) => `- ${s}`).join("\n")}`)
  .join("\n\n")}
Attendees: ${attendees.length > 0 ? attendees.join(", ") : "(not provided)"}
Return a JSON object mapping each label exactly as given to a guessed display name,
e.g. { "Speaker 0": "Alex", "Speaker 1": "Unknown Speaker 1" }.`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: LABEL_SYSTEM_PROMPT,
    temperature: 0.2,
  });

  return labelNameSchema.parse(raw);
}
