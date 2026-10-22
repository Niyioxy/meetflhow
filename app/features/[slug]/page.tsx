import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageView } from "@/components/marketing/marketing-page";
import { getMarketingPage, marketingPagePath, marketingPagesIn } from "@/lib/marketing-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return marketingPagesIn("features").map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getMarketingPage("features", params.slug);
  if (!page) return {};
  const url = marketingPagePath(page);
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: page.metaTitle, description: page.metaDescription },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.metaDescription },
    robots: { index: true, follow: true },
  };
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const page = getMarketingPage("features", params.slug);
  if (!page) notFound();
  return <MarketingPageView page={page} />;
}
