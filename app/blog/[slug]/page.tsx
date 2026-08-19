import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { mdxComponents } from "@/components/marketing/mdx-components";
import { getAllPostSlugs, getPostSource } from "@/lib/blog";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  const url = `/blog/${post.meta.slug}`;
  return {
    title: `${post.meta.title} — MeetFlhow Blog`,
    description: post.meta.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      title: post.meta.title,
      description: post.meta.description,
      publishedTime: post.meta.date,
      authors: [post.meta.author],
      tags: post.meta.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description: post.meta.description,
    },
  };
}

function getPost(slug: string) {
  if (!getAllPostSlugs().includes(slug)) return null;
  return getPostSource(slug);
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const { meta, content } = post;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    author: { "@type": "Organization", name: meta.author },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: `${SITE_URL}/blog/${meta.slug}`,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-8">
        <p className="text-sm text-muted-foreground">
          {new Date(meta.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {" · "}
          {meta.author}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{meta.title}</h1>
        <div className="mt-10">
          <MDXRemote source={content} components={mdxComponents} />
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
