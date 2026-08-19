import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { mdxComponents } from "@/components/marketing/mdx-components";
import { getAllPostSlugs, getPostSource } from "@/lib/blog";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: `${post.meta.title} — MeetFlhow Blog`,
    description: post.meta.description,
    openGraph: {
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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
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
