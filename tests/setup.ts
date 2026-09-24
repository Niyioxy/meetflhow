import { vi } from "vitest";

process.env.NEXTAUTH_URL = "https://app.test";
process.env.INTERNAL_API_SECRET = "internal-test-secret";
process.env.CRON_SECRET = "cron-test-secret";
process.env.DAILY_WEBHOOK_SECRET = Buffer.from("daily-test-secret").toString("base64");

// The app's database client, swapped for a real in-process Postgres.
vi.mock("@/db", async () => {
  const { getTestDb } = await import("./helpers/test-db");
  return { db: (await getTestDb()).db };
});

// Every external service the pipeline talks to. Tests set behaviour per
// case via tests/helpers/mocks.ts.
// The raw model call — modules that do their own post-processing (e.g.
// Sermon Coach's evidence grounding) run for real on top of it.
vi.mock("@/lib/gemini/json", () => ({ geminiJSON: vi.fn() }));
vi.mock("@/lib/gemini/analyze", () => ({ analyzeTranscript: vi.fn() }));
vi.mock("@/lib/gemini/coach", () => ({ generateMeetingCoachScore: vi.fn() }));
vi.mock("@/lib/gemini/sentiment", () => ({ generateSentimentTimeline: vi.fn() }));
vi.mock("@/lib/gemini/speakers", () => ({ identifySpeakers: vi.fn(), nameSpeakerLabels: vi.fn() }));
vi.mock("@/lib/gemini/vertical-content", () => ({
  generateSermonGuide: vi.fn(),
  generatePodcastNotes: vi.fn(),
}));
vi.mock("@/lib/gemini/cost-benchmark", () => ({ generateCostVerdict: vi.fn() }));
vi.mock("@/lib/gemini/embed", () => ({ embedChunks: vi.fn() }));
vi.mock("@/lib/deepgram/transcribe", () => ({ transcribeAudio: vi.fn() }));
vi.mock("@/lib/voice-identification", () => ({ matchSpeakersByVoice: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: vi.fn() }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
vi.mock("@/lib/integrations/slack", () => ({ postMeetingToSlack: vi.fn() }));
vi.mock("@/lib/meeting-recap", () => ({ sendMeetingRecapEmail: vi.fn() }));
vi.mock("@/lib/email/client", () => {
  const send = vi.fn();
  return { getEmailClient: () => ({ emails: { send } }) };
});
vi.mock("@/lib/internal-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/internal-auth")>()),
  triggerInternalStep: vi.fn(),
}));
