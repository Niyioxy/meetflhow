import { z } from "zod";
import { Type } from "@google/genai";
import { geminiJSON } from "./json";
import type { SupportedLanguage } from "@/db/schema";

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "Hindi",
  zh: "Simplified Chinese",
  fr: "French",
  es: "Spanish",
};

const schema = z.object({ translated: z.string() });

const responseSchema = {
  type: Type.OBJECT,
  properties: { translated: { type: Type.STRING } },
  required: ["translated"],
};

const SYSTEM_PROMPT = `You are a live meeting caption translator. You receive one short spoken utterance at a time, possibly mid-sentence, possibly in any language or regional dialect. Translate it into the requested target language, preserving names, technical terms, and proper nouns unchanged. Return only the translation, no commentary.`;

export async function translateUtterance(
  text: string,
  targetLanguage: SupportedLanguage
): Promise<string> {
  if (!text.trim()) return "";

  const prompt = `Target language: ${LANGUAGE_NAMES[targetLanguage]}
Utterance: ${text}
Return JSON: { translated: string }`;

  const raw = await geminiJSON<unknown>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema,
    temperature: 0.1,
  });

  return schema.parse(raw).translated;
}
