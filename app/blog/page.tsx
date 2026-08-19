import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllPosts } from "@/lib/blog";

const TITLE = "Blog — MeetFlhow";
const DESCRIPTION = "Product updates, meeting playbooks, and ideas on making meetings worth having.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    type: "website",
    url: "/blog",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8">
        <div className="mb-14 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Blog</h1>
          <p className="mt-3 text-muted-foreground">
            Product updates, meeting playbooks, and ideas on making meetings worth having.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground">No posts yet — check back soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <Card className="h-full">
                  <CardHeader>
                    {post.tags[0] && (
                      <Badge variant="secondary" className="mb-2 w-fit">
                        {post.tags[0]}
                      </Badge>
                    )}
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    <CardDescription>{post.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
