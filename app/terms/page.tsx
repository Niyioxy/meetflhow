import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_NAME } from "@/lib/site";

const TITLE = `Terms of Service — ${SITE_NAME}`;
const DESCRIPTION = `The terms that govern your use of ${SITE_NAME}.`;
const LAST_UPDATED = "September 9, 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
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

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-8">
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          These terms govern your use of {SITE_NAME} (the &quot;Service&quot;). By creating an
          account or using the Service, you agree to them. If you don&apos;t agree, don&apos;t use
          the Service.
        </p>

        <Section title="1. Your account">
          <p>
            You must provide accurate information when creating an account and are responsible
            for all activity that happens under it. You must be at least 16 years old to use the
            Service.
          </p>
        </Section>

        <Section title="2. Recording consent — your responsibility">
          <p>
            {SITE_NAME} lets you record audio from meetings and calls. Laws on recording
            conversations vary by location — many jurisdictions require the consent of some or
            all participants before a conversation can be recorded.
          </p>
          <p>
            <strong className="text-foreground">
              You are solely responsible for obtaining any consent required by law before
              recording a meeting with {SITE_NAME}, and for complying with all applicable
              recording, wiretapping, and data protection laws.
            </strong>{" "}
            {SITE_NAME} is not responsible for your decision to record any conversation or for
            your compliance with applicable law.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Record any person without the consent required by applicable law</li>
            <li>Upload content you don&apos;t have the right to upload or process</li>
            <li>Attempt to break, reverse-engineer, or overload the Service</li>
            <li>Use the Service for any unlawful, harassing, or fraudulent purpose</li>
          </ul>
        </Section>

        <Section title="4. Your content">
          <p>
            You retain ownership of the recordings, transcripts, and any content you upload
            (&quot;Your Content&quot;). By using the Service, you grant us a limited license to
            store and process Your Content solely to provide the Service to you — generating
            transcripts, summaries, action items, and related analysis. We do not claim ownership
            of Your Content.
          </p>
        </Section>

        <Section title="5. AI-generated output">
          <p>
            Summaries, action items, decisions, sentiment scores, and other analysis are
            generated automatically using AI and speech-to-text models. They may contain errors,
            omissions, or misattributions and should not be treated as a verbatim or authoritative
            record of a meeting. Review AI-generated output before relying on it for important
            decisions.
          </p>
        </Section>

        <Section title="6. Subscriptions and billing">
          <p>
            Some features of the Service may require a paid subscription. Where billing is
            enabled, fees, billing cycles, and cancellation terms will be presented to you at the
            point of purchase. Fees are non-refundable except where required by law.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            You may stop using the Service and delete your account at any time. We may suspend or
            terminate your access if you violate these terms or misuse the Service. Upon
            termination, we will handle your data as described in our{" "}
            <a href="/privacy" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="8. Disclaimer of warranties">
          <p>
            The Service is provided &quot;as is&quot; without warranties of any kind, express or
            implied, including accuracy, reliability, or fitness for a particular purpose. We do
            not guarantee the Service will be uninterrupted, error-free, or that transcripts and
            analysis will be fully accurate.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the maximum extent permitted by law, {SITE_NAME} and its team are not liable for
            any indirect, incidental, or consequential damages arising from your use of the
            Service, including damages resulting from recording without proper consent, data
            loss, or reliance on AI-generated content.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            We may update these terms from time to time. Continued use of the Service after an
            update constitutes acceptance of the revised terms.
          </p>
        </Section>

        <Section title="11. Contact us">
          <p>
            Questions about these terms? Email us at{" "}
            <a href="mailto:legal@meetflhow.com" className="text-foreground underline underline-offset-2">
              legal@meetflhow.com
            </a>
            .
          </p>
        </Section>
      </article>
      <SiteFooter />
    </div>
  );
}
