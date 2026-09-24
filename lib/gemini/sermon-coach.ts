import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";
import { sermonCoachDimensionKeys, type SermonCoach, type TranscriptUtterance } from "@/types/analysis";
import { SERMON_COACH_RUBRIC } from "@/lib/sermon-coach/rubric";
import {
  buildTranscriptIndex,
  groundSermonCoach,
  transcriptForPrompt,
  type RawSermonCoach,
} from "@/lib/sermon-coach/grounding";

const SYSTEM_PROMPT = `You are an experienced preaching coach giving a preacher private, candid, constructive feedback on how well their sermon communicated.

You assess communication craft only. You do not judge whether the theology, doctrine or interpretation is correct, and you never take a denominational position unless explicitly asked to in the instructions.

Evidence rule — this overrides everything else: every observation must quote the transcript verbatim. Copy 6-40 consecutive words exactly as they appear. Never paraphrase inside a quote, never join separate sentences with "..." and never include the [m:ss] markers. If you cannot support an observation with such a quote, leave the observation out.

The transcript is machine-generated from audio: ignore transcription errors and ordinary spoken disfluencies unless they genuinely impede understanding.`;

const observation = {
  type: Type.OBJECT,
  properties: { point: { type: Type.STRING }, excerpt: { type: Type.STRING } },
  required: ["point", "excerpt"],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    dimensions: {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        sermonCoachDimensionKeys.map((key) => [
          key,
          {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              excerpts: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["score", "summary", "excerpts"],
          },
        ])
      ),
      required: [...sermonCoachDimensionKeys],
    },
    strengths: { type: Type.ARRAY, items: observation },
    improvements: { type: Type.ARRAY, items: observation },
    unclearOrRepetitive: { type: Type.ARRAY, items: observation },
    suggestedCuts: { type: Type.ARRAY, items: observation },
    strongestMoment: { ...observation, nullable: true },
    nextSermonFocus: { ...observation, nullable: true },
    claimsToVerify: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          excerpt: { type: Type.STRING },
          passage: { type: Type.STRING },
          passageExcerpt: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["claim", "excerpt", "passage", "passageExcerpt", "reason"],
      },
    },
    traditionNotes: { type: Type.ARRAY, items: observation },
  },
  required: [
    "dimensions",
    "strengths",
    "improvements",
    "unclearOrRepetitive",
    "suggestedCuts",
    "strongestMoment",
    "nextSermonFocus",
    "claimsToVerify",
    "traditionNotes",
  ],
};

const rawObservation = z.object({ point: z.string(), excerpt: z.string() });

const rawSchema = z.object({
  // Exhaustive: every dimension key must be present.
  dimensions: z.record(
    z.enum(sermonCoachDimensionKeys),
    z.object({ score: z.number(), summary: z.string(), excerpts: z.array(z.string()).default([]) })
  ),
  strengths: z.array(rawObservation).default([]),
  improvements: z.array(rawObservation).default([]),
  unclearOrRepetitive: z.array(rawObservation).default([]),
  suggestedCuts: z.array(rawObservation).default([]),
  strongestMoment: rawObservation.nullable().default(null),
  nextSermonFocus: rawObservation.nullable().default(null),
  claimsToVerify: z
    .array(
      z.object({
        claim: z.string(),
        excerpt: z.string(),
        passage: z.string(),
        passageExcerpt: z.string(),
        reason: z.string(),
      })
    )
    .default([]),
  traditionNotes: z.array(rawObservation).default([]),
});

function rubricText(): string {
  return sermonCoachDimensionKeys
    .map((key) => {
      const d = SERMON_COACH_RUBRIC[key];
      return `- ${key} (${d.label}): ${d.question}\n  80-100: ${d.strong}\n  below 50: ${d.weak}`;
    })
    .join("\n");
}

/** Workspace-supplied, so keep it to a short single line before it goes near the prompt. */
function sanitizeTradition(tradition: string | null): string | null {
  const cleaned = tradition?.replace(/[\r\n"`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned ? cleaned : null;
}

export async function generateSermonCoach(input: {
  transcriptText: string;
  utterances?: TranscriptUtterance[] | null;
  tradition?: string | null;
}): Promise<SermonCoach> {
  const tradition = sanitizeTradition(input.tradition ?? null);

  const traditionInstruction = tradition
    ? `The preacher's workspace asked for an additional lens: the "${tradition}" tradition. In traditionNotes only (at most 3), describe where the sermon's emphases or language connect with, or might be heard differently within, that tradition — descriptively, never as a verdict that something is wrong. Keep every other section tradition-neutral.`
    : `Leave traditionNotes empty. Do not comment on doctrine or denominational positions anywhere.`;

  const prompt = `Coach this sermon.

Score each dimension 0-100 against this rubric, with a one-sentence summary and 1-2 verbatim excerpts showing why:
${rubricText()}

Then:
- strengths: 2-4 things that worked, each with a verbatim excerpt.
- improvements: 2-4 specific, actionable changes, each with a verbatim excerpt of where it applies.
- unclearOrRepetitive: 0-3 sections that were unclear or repeated without adding anything, quoting the section.
- suggestedCuts: 0-3 passages that could be cut or shortened without losing the main idea, quoting their opening.
- strongestMoment: the single most effective moment, quoted.
- nextSermonFocus: the one skill to focus on next time, anchored to an excerpt from this sermon that shows why.
- claimsToVerify: 0-5 factual or textual statements the preacher should double-check before reusing them — e.g. what an original-language word means, historical or cultural background, authorship or dating, or what a passage says. Only claims about a passage the preacher actually cites or reads in this sermon. Each needs: the claim, a verbatim excerpt where it's made, the passage reference, a verbatim passageExcerpt where that passage is cited in the sermon, and a reason phrased as what to check (not a verdict). If you can't give both excerpts, omit the claim. Never flag something because you disagree with it theologically.

${traditionInstruction}

Sermon transcript${input.utterances?.length ? " (lines start with [m:ss] timestamps — never include them in quotes)" : ""}:
${transcriptForPrompt(input.transcriptText, input.utterances)}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.2,
    thinkingBudget: 2048,
  });

  const parsed = rawSchema.parse(raw) as RawSermonCoach;
  return groundSermonCoach(parsed, buildTranscriptIndex(input.transcriptText, input.utterances), tradition);
}
