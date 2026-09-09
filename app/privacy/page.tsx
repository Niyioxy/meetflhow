import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_NAME } from "@/lib/site";

const TITLE = `Privacy Policy — ${SITE_NAME}`;
const DESCRIPTION = `How ${SITE_NAME} collects, uses, and protects your data.`;
const LAST_UPDATED = "September 9, 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-8">
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          {SITE_NAME} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides an AI meeting
          assistant that records, transcribes, and analyzes meetings on your behalf. This policy
          explains what data we collect, why, and the choices you have over it.
        </p>

        <Section title="1. Information we collect">
          <p>
            <strong className="text-foreground">Account information.</strong> When you sign in
            with Google or Microsoft, we receive your name, email address, and profile picture
            from that provider. If you sign in by email link, we store the email address you
            provide.
          </p>
          <p>
            <strong className="text-foreground">Calendar data.</strong> If you connect Google
            Calendar or Microsoft Calendar, we access event details (titles, times, attendees,
            and meeting links) so we can schedule recordings and match recaps to the right
            meeting. We do not modify or delete your calendar events unless you explicitly use a
            feature that does so (e.g. scheduling a meeting through {SITE_NAME}).
          </p>
          <p>
            <strong className="text-foreground">Recordings and transcripts.</strong> When you
            record or upload a meeting, we process the audio to produce a transcript, speaker
            labels, summary, action items, and related analysis. Audio and transcripts are
            stored on your account until you delete them.
          </p>
          <p>
            <strong className="text-foreground">Voice profile.</strong> If you enrol a voice
            profile, we store a voiceprint derived from a short audio sample so we can identify
            you as a speaker in future recordings. This is used only for speaker attribution
            within your own account and is not shared with third parties.
          </p>
          <p>
            <strong className="text-foreground">Usage data.</strong> We use Google Analytics to
            understand how the product is used (pages visited, feature usage, general device and
            location information). This does not include meeting content.
          </p>
        </Section>

        <Section title="2. How we use your information">
          <p>We use the information above to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Generate transcripts, summaries, action items, decisions, and other analysis of your meetings</li>
            <li>Identify speakers in your recordings using your enrolled voice profile</li>
            <li>Match recordings to calendar events for scheduling and post-meeting recaps</li>
            <li>Send recap emails to meeting attendees you choose to share with, or who missed a meeting you recorded</li>
            <li>Maintain and improve the reliability and security of the service</li>
            <li>Communicate with you about your account or changes to the service</li>
          </ul>
          <p>
            We do not sell your personal information or meeting content, and we do not use your
            recordings or transcripts to train third-party AI models beyond what is required to
            generate the analysis you requested for that meeting.
          </p>
        </Section>

        <Section title="3. Third-party processors">
          <p>
            We rely on the following subprocessors to operate {SITE_NAME}. Each only receives the
            data it needs to perform its function:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-foreground">Google / Microsoft</strong> — authentication and calendar access</li>
            <li><strong className="text-foreground">Deepgram</strong> — speech-to-text transcription and speaker diarization</li>
            <li><strong className="text-foreground">Google Gemini</strong> — meeting analysis (summaries, decisions, action items, sentiment)</li>
            <li><strong className="text-foreground">Vercel</strong> — application hosting and audio file storage</li>
            <li><strong className="text-foreground">Neon</strong> — database hosting</li>
            <li><strong className="text-foreground">Brevo</strong> — transactional email delivery (recaps, notifications)</li>
            <li><strong className="text-foreground">Google Analytics</strong> — product usage analytics</li>
          </ul>
        </Section>

        <Section title="4. Sharing meeting content">
          <p>
            Your recordings, transcripts, and analysis are visible only to you unless you take an
            explicit action to share them — for example, sharing a meeting with your workspace,
            generating a public share link, or sending a recap email to an attendee. A public
            share link is accessible to anyone who has the link (optionally protected by a
            password you set) until you revoke or it expires.
          </p>
        </Section>

        <Section title="5. Data retention and deletion">
          <p>
            We retain your account data and meeting content for as long as your account is
            active. You can delete individual meetings at any time from within the app, which
            permanently removes the recording, transcript, and analysis. You can request deletion
            of your entire account and all associated data by contacting us at the email below.
          </p>
        </Section>

        <Section title="6. Your rights">
          <p>
            Depending on where you live, you may have the right to access, correct, export, or
            delete your personal information, and to withdraw consent for calendar or voice
            profile access at any time from Settings. You can disconnect Google or Microsoft
            access from your account provider&apos;s own security settings at any time, which
            revokes {SITE_NAME}&apos;s access to your calendar.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            We use industry-standard measures — encrypted connections (TLS), access controls, and
            hosting providers with recognized security practices — to protect your data. No
            method of transmission or storage is 100% secure, and we cannot guarantee absolute
            security.
          </p>
        </Section>

        <Section title="8. Children's privacy">
          <p>
            {SITE_NAME} is not directed at children under 16, and we do not knowingly collect
            personal information from them.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this policy from time to time. If we make material changes, we will
            update the &quot;Last updated&quot; date above and, where appropriate, notify you
            directly.
          </p>
        </Section>

        <Section title="10. Contact us">
          <p>
            Questions about this policy or your data? Email us at{" "}
            <a href="mailto:privacy@meetflhow.com" className="text-foreground underline underline-offset-2">
              privacy@meetflhow.com
            </a>
            .
          </p>
        </Section>
      </article>
      <SiteFooter />
    </div>
  );
}
