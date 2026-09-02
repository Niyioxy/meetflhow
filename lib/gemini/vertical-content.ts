import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";
import type { SermonGuide, PodcastNotes } from "@/types/analysis";

const sermonGuideSchema = z.object({
  centralTheme: z.string(),
  scriptureReferences: z.array(z.string()),
  discussionQuestions: z.array(z.string()),
});

const SERMON_SYSTEM_PROMPT = `You are an expert at writing small-group discussion guides from sermon transcripts. Base everything strictly on the transcript — never invent scripture references, quotes, or themes that weren't actually said.`;

const sermonResponseSchema = {
  type: Type.OBJECT,
  properties: {
    centralTheme: { type: Type.STRING },
    scriptureReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
    discussionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["centralTheme", "scriptureReferences", "discussionQuestions"],
};

export async function generateSermonGuide(transcriptText: string): Promise<SermonGuide> {
  const prompt = `Sermon transcript:
${transcriptText}

Write a small-group discussion guide for this sermon. Return JSON:
{
  centralTheme: string (one sentence capturing the sermon's central message),
  scriptureReferences: string[] (only references actually cited or clearly quoted in the transcript — empty array if none),
  discussionQuestions: string[] (5-7 open-ended questions a small group could discuss, moving from understanding the message to applying it personally)
}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SERMON_SYSTEM_PROMPT,
    responseSchema: sermonResponseSchema,
    temperature: 0.4,
  });

  const parsed = sermonGuideSchema.parse(raw);
  return { kind: "sermon_guide", ...parsed };
}

const podcastNotesSchema = z.object({
  episodeSummary: z.string(),
  chapters: z.array(z.object({ title: z.string(), description: z.string() })),
  pullQuotes: z.array(z.string()),
});

const PODCAST_SYSTEM_PROMPT = `You are an expert podcast producer writing show notes. Base everything strictly on the transcript — pull quotes must be near-verbatim lines actually said, not paraphrased or invented.`;

const podcastResponseSchema = {
  type: Type.OBJECT,
  properties: {
    episodeSummary: { type: Type.STRING },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["title", "description"],
      },
    },
    pullQuotes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["episodeSummary", "chapters", "pullQuotes"],
};

export async function generatePodcastNotes(transcriptText: string): Promise<PodcastNotes> {
  const prompt = `Podcast episode transcript:
${transcriptText}

Write show notes for this episode. Return JSON:
{
  episodeSummary: string (2-3 sentences suitable for an episode description),
  chapters: { title: string, description: string }[] (an ordered table of contents breaking the episode into its main topic sections, one sentence description each),
  pullQuotes: string[] (2-4 short, near-verbatim quotable lines actually said in the episode, suitable for social media)
}`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: PODCAST_SYSTEM_PROMPT,
    responseSchema: podcastResponseSchema,
    temperature: 0.4,
  });

  const parsed = podcastNotesSchema.parse(raw);
  return { kind: "podcast_notes", ...parsed };
}
