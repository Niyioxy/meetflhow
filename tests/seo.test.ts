import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// next/font only works inside Next's compiler; the layout is imported here
// just for its exported metadata.
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "" }) }));

import middleware from "@/middleware";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { metadata } from "@/app/layout";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as contactMetadata } from "@/app/contact/page";
import { generateMetadata as solutionMetadata } from "@/app/solutions/[slug]/page";
import { generateMetadata as featureMetadata } from "@/app/features/[slug]/page";
import { MARKETING_PAGES, getMarketingPage, marketingPagePath } from "@/lib/marketing-pages";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

describe("search metadata", () => {
  it("keeps the title and description inside what search results show", () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("leads with what people search for, not the category name", () => {
    expect(SITE_TITLE).toMatch(/AI Meeting Notes/);
    expect(SITE_TITLE).not.toMatch(/Meeting Intelligence/);
  });

  it("uses the same title for the page, Open Graph and Twitter cards", () => {
    expect(metadata.title).toBe(SITE_TITLE);
    expect(metadata.openGraph?.title).toBe(SITE_TITLE);
    expect(metadata.twitter?.title).toBe(SITE_TITLE);
  });

  it("gives About and Contact their own canonical URL so they don't inherit the home page's", () => {
    expect(aboutMetadata.alternates?.canonical).toBe("/about");
    expect(contactMetadata.alternates?.canonical).toBe("/contact");
  });
});

describe("crawlability", () => {
  it("lists the trust pages in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(expect.arrayContaining(["https://meetflhow.com/about", "https://meetflhow.com/contact"]));
  });

  it("keeps per-link private pages out of search", () => {
    const rules = robots().rules;
    const disallow = ([] as string[]).concat(...[rules].flat().map((rule) => rule.disallow ?? []));
    expect(disallow).toEqual(expect.arrayContaining(["/book", "/call", "/share", "/api/"]));
  });
});

describe("solution and integration pages", () => {
  const key = (page: { section: string; slug: string }) => `${page.section}/${page.slug}`;

  it("has unique URLs and complete content", () => {
    const keys = MARKETING_PAGES.map(key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(MARKETING_PAGES.length).toBeGreaterThanOrEqual(5);
    for (const page of MARKETING_PAGES) {
      expect(page.outputs.length, key(page)).toBeGreaterThanOrEqual(3);
      expect(page.steps.length, key(page)).toBe(3);
      expect(page.faq.length, key(page)).toBeGreaterThanOrEqual(3);
      expect(page.goodToKnow.length, key(page)).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every title and description inside what search results show", () => {
    for (const page of MARKETING_PAGES) {
      expect(page.metaTitle.length, `${key(page)} title`).toBeLessThanOrEqual(60);
      expect(page.metaDescription.length, `${key(page)} description`).toBeLessThanOrEqual(160);
    }
    const titles = MARKETING_PAGES.map((page) => page.metaTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("only links to pages that exist", () => {
    for (const page of MARKETING_PAGES) {
      for (const ref of page.related) {
        expect(getMarketingPage(ref.section, ref.slug), `${key(page)} -> ${ref.section}/${ref.slug}`).toBeDefined();
        expect(`${ref.section}/${ref.slug}`).not.toBe(key(page));
      }
    }
  });

  it("is in the sitemap, serves its own canonical URL, and is open to signed-out visitors", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const page of MARKETING_PAGES) {
      expect(urls).toContain(`https://meetflhow.com${marketingPagePath(page)}`);
      const generate = page.section === "solutions" ? solutionMetadata : featureMetadata;
      expect(generate({ params: { slug: page.slug } }).alternates?.canonical).toBe(marketingPagePath(page));
      const response = middleware(new NextRequest(`https://app.test${marketingPagePath(page)}`));
      expect(response.headers.get("location"), key(page)).toBeNull();
    }
    expect(solutionMetadata({ params: { slug: "nope" } })).toEqual({});
  });

  it("doesn't overstate the features whose limits matter", () => {
    const text = (slug: string) =>
      JSON.stringify(getMarketingPage("solutions", slug) ?? getMarketingPage("features", slug)).toLowerCase();
    // Deal Radar is fixed-phrase matching, not AI intent detection.
    expect(text("sales-calls")).toContain("keyword matching");
    expect(text("sales-calls")).toContain("doesn't understand context or tone");
    // Podcast chapters have no timestamps; Notion gets an excerpt and is manual.
    expect(text("podcasters")).toContain("don't include timestamps");
    expect(text("notion-integration")).toContain("2,000 characters");
    expect(text("notion-integration")).toContain("not today");
  });
});

describe("public pages in middleware", () => {
  const visit = (path: string) => middleware(new NextRequest(`https://app.test${path}`));

  it("lets a signed-out visitor read About and Contact", () => {
    for (const path of ["/about", "/contact", "/privacy", "/terms", "/blog"]) {
      expect(visit(path).headers.get("location"), path).toBeNull();
    }
  });

  it("still sends a signed-out visitor to login for app pages, and not for look-alike prefixes", () => {
    for (const path of ["/meetings", "/dashboard", "/aboutus", "/contactless"]) {
      expect(visit(path).headers.get("location"), path).toContain("/login");
    }
  });
});
