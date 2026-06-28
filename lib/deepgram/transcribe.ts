import { deepgram } from "./client";

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationSeconds: number | null;
}

export async function transcribeAudio(
  file: File
): Promise<TranscriptionResult> {
  const response = await deepgram.listen.v1.media.transcribeFile(file, {
    model: "nova-3",
    smart_format: true,
    detect_language: true,
  });

  if (!("results" in response)) {
    throw new Error("Deepgram returned an async-accepted response instead of a transcript");
  }

  const channel = response.results.channels[0];
  const alternative = channel?.alternatives?.[0];

  return {
    text: alternative?.transcript ?? "",
    language: channel?.detected_language ?? null,
    durationSeconds: response.metadata.duration ?? null,
  };
}
