export const SITE_URL = "https://meetflhow.com";
export const SITE_NAME = "MeetFlhow";
// The title leads with what people actually search for ("AI meeting notes"),
// not the category name. Keep the title under ~60 characters and the
// description under ~160 so search results don't truncate them.
export const SITE_TITLE = `${SITE_NAME} — AI Meeting Notes, Summaries & Action Items`;
export const SITE_DESCRIPTION =
  "AI meeting notes with transcripts, speaker recognition, summaries, decisions and action items. Record, upload or capture calls, and sync to Slack and Notion.";

// Mailboxes the site can publish. Only add an address here once it is a real,
// monitored inbox — a bounced contact email hurts trust more than none.
export const PRIVACY_EMAIL = "privacy@meetflhow.com";
export const LEGAL_EMAIL = "legal@meetflhow.com";
// General questions, support and feedback. Empty hides the row on /contact.
export const GENERAL_EMAIL = "";

// GA4 Measurement ID (e.g. "G-XXXXXXXXXX"). Not a secret — it's public in
// every page's client-side script — so it's a plain constant, not an env var.
// Empty string disables analytics entirely (safe no-op).
export const GA_MEASUREMENT_ID = "G-WSTF49MLTC";
