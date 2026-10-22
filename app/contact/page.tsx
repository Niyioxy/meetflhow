import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { GENERAL_EMAIL, LEGAL_EMAIL, PRIVACY_EMAIL, SITE_NAME } from "@/lib/site";

const TITLE = `Contact ${SITE_NAME}`;
const DESCRIPTION = `How to reach ${SITE_NAME} about your account, your data, or our terms.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "/contact", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

const CONTACTS = [
  {
    topic: "General questions, support and feedback",
    email: GENERAL_EMAIL,
  },
  {
    topic: "Privacy and your data — access, correction, deletion",
    email: PRIVACY_EMAIL,
  },
  {
    topic: "Legal and terms of service",
    email: LEGAL_EMAIL,
  },
].filter((contact) => contact.email);

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Email the address that matches your question and it will reach the right place.
        </p>

        <ul className="mt-10 flex flex-col divide-y divide-border rounded-lg border border-border">
          {CONTACTS.map((contact) => (
            <li
              key={contact.email}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-muted-foreground">{contact.topic}</span>
              <a
                href={`mailto:${contact.email}`}
                className="text-sm font-medium text-foreground underline underline-offset-2"
              >
                {contact.email}
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
          Already using {SITE_NAME}? Include the email address you sign in with so we can find your
          account.
        </p>
      </article>
      <SiteFooter />
    </div>
  );
}
