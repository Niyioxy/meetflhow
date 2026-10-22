import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getMarketingPage, marketingPagePath, type MarketingPage } from "@/lib/marketing-pages";

const SECTION_LABEL = { solutions: "Solutions", features: "Features" } as const;

function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-6 py-14 sm:px-8 ${className ?? ""}`}>{children}</section>
  );
}

function structuredData(page: MarketingPage) {
  const url = `${SITE_URL}${marketingPagePath(page)}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: SECTION_LABEL[page.section] },
        { "@type": "ListItem", position: 3, name: page.navLabel, item: url },
      ],
    },
  ];
}

export function MarketingPageView({ page }: { page: MarketingPage }) {
  const related = page.related
    .map((ref) => getMarketingPage(ref.section, ref.slug))
    .filter((p): p is MarketingPage => Boolean(p));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {structuredData(page).map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      <SiteHeader />

      <main className="flex-1">
        <Section className="pb-6 pt-20">
          <p className="text-sm font-medium text-[var(--blue-light)]">{page.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{page.h1}</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{page.lede}</p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/login">Get started free</Link>
            </Button>
          </div>
        </Section>

        <Section className="border-t border-border">
          <h2 className="text-2xl font-semibold tracking-tight">{page.outputsHeading}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {page.outputs.map((output) => (
              <Card key={output.title} className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">{output.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{output.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Section>

        <Section className="border-t border-border">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {page.steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-card-hover)] text-sm font-semibold text-[var(--blue-light)]">
                  {index + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section className="border-t border-border">
          <Card className="border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.06)]">
            <CardContent className="py-6">
              <h2 className="text-lg font-semibold">Good to know</h2>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {page.goodToKnow.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>

        <Section className="border-t border-border">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-6 flex flex-col divide-y divide-border rounded-lg border border-border">
            {page.faq.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {related.length > 0 && (
          <Section className="border-t border-border">
            <h2 className="text-lg font-semibold tracking-tight">Related</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {related.map((item) => (
                <li key={marketingPagePath(item)}>
                  <Link
                    href={marketingPagePath(item)}
                    className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section className="border-t border-border">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">Try it on your next recording</h2>
              <p className="max-w-xl text-sm text-muted-foreground">
                Free to start, no credit card required.
              </p>
              <Button size="lg" asChild>
                <Link href="/login">Get started free</Link>
              </Button>
            </CardContent>
          </Card>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
