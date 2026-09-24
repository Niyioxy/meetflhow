import { vi, type Mock } from "vitest";
import { analyzeTranscript } from "@/lib/gemini/analyze";
import { generateMeetingCoachScore } from "@/lib/gemini/coach";
import { generateSentimentTimeline } from "@/lib/gemini/sentiment";
import { identifySpeakers, nameSpeakerLabels } from "@/lib/gemini/speakers";
import { embedChunks } from "@/lib/gemini/embed";
import { transcribeAudio } from "@/lib/deepgram/transcribe";
import { matchSpeakersByVoice } from "@/lib/voice-identification";
import { del } from "@vercel/blob";
import { postMeetingToSlack } from "@/lib/integrations/slack";
import { sendMeetingRecapEmail } from "@/lib/meeting-recap";
import { getEmailClient } from "@/lib/email/client";
import { triggerInternalStep } from "@/lib/internal-auth";

const asMock = (fn: unknown) => fn as Mock;

export const mocks = {
  analyzeTranscript: asMock(analyzeTranscript),
  coach: asMock(generateMeetingCoachScore),
  sentiment: asMock(generateSentimentTimeline),
  identifySpeakers: asMock(identifySpeakers),
  nameSpeakerLabels: asMock(nameSpeakerLabels),
  embedChunks: asMock(embedChunks),
  transcribeAudio: asMock(transcribeAudio),
  matchSpeakersByVoice: asMock(matchSpeakersByVoice),
  blobDel: asMock(del),
  postMeetingToSlack: asMock(postMeetingToSlack),
  sendMeetingRecapEmail: asMock(sendMeetingRecapEmail),
  emailSend: asMock(getEmailClient().emails.send),
  triggerInternalStep: asMock(triggerInternalStep),
  fetch: vi.fn(),
};

/**
 * Two action items with identical text on purpose: a task must mirror each
 * of them, which matching tasks to action items by title can't do.
 */
export const ANALYSIS_RESULT = {
  summary: "We agreed to ship the deck.",
  decisions: ["Ship the deck"],
  openQuestions: [],
  highlights: [],
  sentiment: "positive",
  actionItems: [
    { task: "Send the deck", owner: "Ana", deadline: null, priority: "high" },
    { task: "Send the deck", owner: "Ben", deadline: null, priority: "medium" },
  ],
};

/** Every call gets a fresh 200 response, and is recorded for assertions. */
export function okResponse() {
  return new Response("ok", { status: 200 });
}

export function resetMocks() {
  vi.clearAllMocks();
  mocks.analyzeTranscript.mockResolvedValue(ANALYSIS_RESULT);
  mocks.coach.mockResolvedValue({ overall_score: 82 });
  mocks.sentiment.mockResolvedValue({ points: [] });
  mocks.identifySpeakers.mockResolvedValue([]);
  mocks.nameSpeakerLabels.mockResolvedValue({});
  mocks.embedChunks.mockImplementation(async (chunks: string[]) =>
    chunks.map(() => Array.from({ length: 768 }, () => 0.1))
  );
  mocks.transcribeAudio.mockResolvedValue({
    text: "Hello team, let's ship the deck.",
    language: "en",
    utterances: [],
    durationSeconds: 61.4,
  });
  mocks.matchSpeakersByVoice.mockResolvedValue({});
  mocks.blobDel.mockResolvedValue(undefined);
  mocks.postMeetingToSlack.mockResolvedValue({ ok: true });
  mocks.sendMeetingRecapEmail.mockResolvedValue(undefined);
  mocks.emailSend.mockResolvedValue({});
  mocks.triggerInternalStep.mockResolvedValue(undefined);
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async () => okResponse());
  vi.stubGlobal("fetch", mocks.fetch);
}

/** fetch calls made to one URL (e.g. a webhook endpoint). */
export function fetchCallsTo(url: string) {
  return mocks.fetch.mock.calls.filter(([target]) => String(target) === url);
}

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets pending promise callbacks (and PGlite queries) run. */
export async function flush(times = 20) {
  for (let i = 0; i < times; i++) await new Promise((r) => setImmediate(r));
}
