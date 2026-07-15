# MeetFlhow

AI meeting intelligence: upload or record a meeting, get a transcript (Deepgram), and a summary, action items, decisions, open questions, and sentiment (Gemini).

## Stack

Next.js 14 (App Router) · Neon Postgres · Drizzle ORM · NextAuth.js (Auth.js v5, Google OAuth) · Deepgram + Gemini · Tailwind CSS v4 + shadcn/ui

## Setup

1. **Install dependencies** (already done if you're reading this from the generated project):

   ```bash
   npm install
   ```

2. **Create a Neon database** at [neon.tech](https://neon.tech) and copy its connection string.

3. **Create a Google OAuth client** at the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (and your production URL equivalent)

4. **Copy `.env.example` to `.env.local`** and fill in real values:

   ```bash
   cp .env.example .env.local
   ```

   - `DATABASE_URL` — Neon connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `http://localhost:3000` locally
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from step 3
   - `DEEPGRAM_API_KEY` — from [console.deepgram.com](https://console.deepgram.com)
   - `GEMINI_API_KEY` — from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

5. **Push the schema to Neon:**

   ```bash
   npm run db:migrate
   ```

   (A migration is already generated at `drizzle/0000_massive_johnny_storm.sql`. `db:migrate` applies it. Use `npm run db:generate` after future schema changes, and `npm run db:studio` to browse data.)

6. **Run the dev server:**

   ```bash
   npm run dev
   ```

## Voice recognition service

Speaker voice recognition (enrolment + identification) runs through a
self-hosted Python microservice at [`voice-service/`](voice-service) using
SpeechBrain's ECAPA-TDNN speaker embedding model — no API keys or usage
limits. It must be running alongside the Next.js app in dev for voice
enrolment/identification to work; without it, those features fail closed
(the app still works, meetings just fall back to Gemini's speaker guesses).

Set up once:

```bash
cd voice-service
python -m venv .venv
.venv\Scripts\activate   # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
```

Requires the `ffmpeg` binary on your `PATH` (used to normalize uploaded audio
before embedding).

Then, side by side with `npm run dev`, run:

```bash
npm run voice-service
```

which starts `uvicorn main:app --port 8001 --reload`. Set
`VOICE_SERVICE_URL` in `.env.local` (defaults to `http://localhost:8001`,
see `.env.example`) so the Next.js app knows where to reach it.

## Notes

- The Deepgram and Gemini calls in `/api/meetings/upload` and `/api/meetings/analyze` can take a while for long meetings — both routes are configured with `maxDuration = 300`. On Vercel, this requires a plan that supports extended function durations.
- Session strategy is database-backed (Auth.js v5 + Drizzle adapter), so signing out anywhere invalidates the session everywhere.
