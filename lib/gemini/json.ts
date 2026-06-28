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
