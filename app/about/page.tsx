import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/site";

const TITLE = `About ${SITE_NAME} — AI Meeting Notes Built Around What You Record`;
const DESCRIPTION = `Why ${SITE_NAME} exists, who it's for, and how it turns meetings, sermons, podcasts and sales calls into notes you can act on.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { type: "website", url: "/about", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About {SITE_NAME}</h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          {SITE_NAME} records your meetings, transcribes them, and turns them into something you can
          use afterwards: a summary, the decisions that were made, and action items with a real owner
          attached.
        </p>

        <Section title="Why it exists">
          <p>
            {SITE_NAME} was built after an important recorded conversation was lost — twice — and
            could never be recovered. That shaped the product from the start: a recording is saved
            to your account the moment you stop, and a copy is kept on your device if the upload
            fails, so a closed tab or a dropped connection doesn&apos;t cost you the conversation.
          </p>
        </Section>

        <Section title="Built around what you recorded">
          <p>
            A sermon, a podcast and a sales call are different things, so they shouldn&apos;t all get
            the same summary template. {SITE_NAME} shapes its output to the recording:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong className="text-foreground">Teams and sales:</strong> decisions, action items
              with owners, and live flags for buying and risk phrases during a call.
            </li>
            <li>
              <strong className="text-foreground">Churches:</strong> sermons become discussion
              questions and scripture references.
            </li>
            <li>
              <strong className="text-foreground">Podcasters:</strong> episodes become show notes, a
              chapter outline and quote-ready pull-quotes.
            </li>
            <li>
              <strong className="text-foreground">Client-facing professionals:</strong> a durable
              record of every call, and an easy way to send a recap to someone who missed it.
            </li>
          </ul>
        </Section>

        <Section title="Who said it, not just “Speaker 1”">
          <p>
            Most tools guess speaker labels from audio alone. {SITE_NAME} can learn your voice, so it
            knows when it is actually you speaking. That is what lets an action item be assigned to
            the right person&apos;s account, and lets a recap go to someone who really wasn&apos;t
            there.
          </p>
        </Section>

        <Section title="Where it is today">
          <p>
            {SITE_NAME} is an early product, in active development and used in real meetings while
            it is built. You can sign in and use it today. If something is missing or doesn&apos;t
            work the way you&apos;d expect, we want to hear about it.
          </p>
          <p>
            For how your data is handled, read the{" "}
            <Link href="/privacy" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
            . To reach us, see the{" "}
            <Link href="/contact" className="text-foreground underline underline-offset-2">
              contact page
            </Link>
            .
          </p>
        </Section>

        <div className="mt-12">
          <Button asChild>
            <Link href="/login">Get started free</Link>
          </Button>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
