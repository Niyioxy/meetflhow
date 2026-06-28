import { Resend } from "resend";

let client: Resend | null = null;

/** Lazily constructed so builds/dev don't fail before RESEND_API_KEY is configured. */
export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}
