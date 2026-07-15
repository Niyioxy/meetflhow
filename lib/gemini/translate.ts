import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";
import type { SpeakerSegment } from "@/types/analysis";
import type {
  SupportedLanguage,
  TranslatedActionItem,
  TranslatedTranscriptSegment,
} from "@/db/schema";

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "Hindi",
  zh: "Simplified Chinese",
  fr: "French",
  es: "Spanish",
};

const translationSchema = z.object({
  summary: z.string().nullable().default(null),
  transcript_segments: z
    .array(z.object({ speaker: z.string(), text: z.string() }))
    .default([]),
  action_items: z
    .array(
      z.object({
        task: z.string(),
        owner: z.string().nullable().default(null),
        deadline: z.string().nullable().default(null),
      })
    )
    .default([]),
});

type TranslationResult = z.infer<typeof translationSchema>;

const SYSTEM_PROMPT = `You are an expert translator for meeting content. The source content may be monolingual or may mix multiple languages or regional dialects within the same transcript (e.g. different speakers switching languages mid-meeting) — detect and translate every segment into the requested target language regardless of which language it was originally spoken in. Preserve speaker names, technical terms, and proper nouns unchanged. Return strictly valid JSON matching the schema, using empty arrays/null for any field not present in the input.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, nullable: true },
    transcript_segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
        },
        required: ["speaker", "text"],
      },
    },
    action_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING },
          owner: { type: Type.STRING, nullable: true },
          deadline: { type: Type.STRING, nullable: true },
        },
        required: ["task"],
      },
    },
  },
  required: ["summary", "transcript_segments", "action_items"],
};

const CHUNK_CHAR_LIMIT = 30_000;

interface ChunkPayload {
  summary?: string;
  segments: { speaker: string; text: string }[];
  actionItems: { task: string; owner: string | null; deadline: string | null }[];
}

function buildPrompt(languageName: string, payload: ChunkPayload): string {
  return `Translate this meeting content to ${languageName}.
Preserve speaker names, technical terms, and proper nouns unchanged. Return JSON:
{
  summary: string,
  transcript_segments: [{ speaker, text }],
  action_items: [{ task, owner, deadline }]
}
Content:
Summary: ${payload.summary ?? "(none)"}
Transcript segments: ${JSON.stringify(payload.segments)}
Action items: ${JSON.stringify(payload.actionItems)}`;
}

async function translateChunk(
  languageName: string,
  payload: ChunkPayload
): Promise<TranslationResult> {
  const raw = await geminiJSON<unknown>(buildPrompt(languageName, payload), {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.2,
  });
  return translationSchema.parse(raw);
}

export interface TranslateMeetingContentInput {
  targetLanguage: SupportedLanguage;
  summary: string | null;
  transcriptSegments: SpeakerSegment[];
  actionItems: { task: string; owner: string | null; deadline: string | null }[];
}

export interface TranslateMeetingContentResult {
  summary: string | null;
  transcriptSegments: TranslatedTranscriptSegment[];
  actionItems: TranslatedActionItem[];
}

export async function translateMeetingContent(
  input: TranslateMeetingContentInput
): Promise<TranslateMeetingContentResult> {
  const languageName = LANGUAGE_NAMES[input.targetLanguage];
  const totalChars = input.transcriptSegments.reduce((sum, s) => sum + s.text.length, 0);

  if (totalChars <= CHUNK_CHAR_LIMIT) {
    const result = await translateChunk(languageName, {
      summary: input.summary ?? undefined,
      segments: input.transcriptSegments.map((s) => ({ speaker: s.speaker, text: s.text })),
      actionItems: input.actionItems,
    });
    return {
      summary: input.summary ? result.summary : null,
      transcriptSegments: result.transcript_segments,
      actionItems: result.action_items,
    };
  }

  // Long transcript: chunk into ~30k-char groups, translate in parallel, reassemble.
  const chunks: SpeakerSegment[][] = [];
  let current: SpeakerSegment[] = [];
  let currentChars = 0;
  for (const segment of input.transcriptSegments) {
    if (currentChars + segment.text.length > CHUNK_CHAR_LIMIT && current.length > 0) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(segment);
    currentChars += segment.text.length;
  }
  if (current.length > 0) chunks.push(current);

  const [summaryResult, ...transcriptResults] = await Promise.all([
    translateChunk(languageName, {
      summary: input.summary ?? undefined,
      segments: [],
      actionItems: input.actionItems,
    }),
    ...chunks.map((chunk) =>
      translateChunk(languageName, {
        segments: chunk.map((s) => ({ speaker: s.speaker, text: s.text })),
        actionItems: [],
      })
    ),
  ]);

  return {
    summary: input.summary ? summaryResult.summary : null,
    transcriptSegments: transcriptResults.flatMap((r) => r.transcript_segments),
    actionItems: summaryResult.action_items,
  };
}
