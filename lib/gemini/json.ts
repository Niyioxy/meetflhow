import { gemini } from "./client";

interface GeminiJSONOptions {
  systemInstruction?: string;
  responseSchema?: object;
  temperature?: number;
}

export async function geminiJSON<T>(
  prompt: string,
  options: GeminiJSONOptions = {}
): Promise<T> {
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: options.temperature ?? 0.3,
      // These are mostly structured-extraction tasks, not deep-reasoning
      // ones — the default dynamic thinking budget adds unpredictable
      // latency for little benefit here, and matters since these calls run
      // inside a hard-capped serverless function (see runAllMeetingAnalyses).
      // Small non-zero budget: still fast, but leaves the model a little
      // room to reason on trickier transcripts (crosstalk, implied action
      // items) rather than cutting reasoning off entirely.
      thinkingConfig: { thinkingBudget: 512 },
      ...(options.systemInstruction
        ? { systemInstruction: options.systemInstruction }
        : {}),
      ...(options.responseSchema
        ? { responseSchema: options.responseSchema }
        : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini did not return a response");
  }

  return JSON.parse(text) as T;
}
