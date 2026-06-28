import { DeepgramClient } from "@deepgram/sdk";

if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error("DEEPGRAM_API_KEY is not set");
}

export const deepgram = new DeepgramClient({
  apiKey: process.env.DEEPGRAM_API_KEY,
});
