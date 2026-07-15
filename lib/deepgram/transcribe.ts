import { deepgram } from "./client";

export interface TranscriptUtterance {
  speaker: number;
  start: number;
  end: number;
  transcript: string;
}

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  utterances: TranscriptUtterance[];
}

export async function transcribeAudio(
  file: File
): Promise<TranscriptionResult> {
  const response = await deepgram.listen.v1.media.transcribeFile(file, {
    model: "nova-3",
    smart_format: true,
    detect_language: true,
    diarize: true,
    utterances: true,
  });

  if (!("results" in response)) {
    throw new Error("Deepgram returned an async-accepted response instead of a transcript");
  }

  const channel = response.results.channels[0];
  const alternative = channel?.alternatives?.[0];

  const utterances: TranscriptUtterance[] = (response.results.utterances ?? [])
    .filter((u) => u.speaker !== undefined && u.start !== undefined && u.end !== undefined && u.transcript)
    .map((u) => ({
      speaker: u.speaker as number,
      start: u.start as number,
      end: u.end as number,
      transcript: u.transcript as string,
    }));

  return {
    text: alternative?.transcript ?? "",
    language: channel?.detected_language ?? null,
    durationSeconds: response.metadata.duration ?? null,
    utterances,
  };
}
