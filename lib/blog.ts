import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
};

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

function readPost(slug: string): { meta: BlogPostMeta; content: string } {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  return {
    meta: {
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      author: data.author,
      tags: data.tags ?? [],
    },
    content,
  };
}

export function getPostSource(slug: string): { meta: BlogPostMeta; content: string } {
  return readPost(slug);
}

export function getAllPosts(): BlogPostMeta[] {
  return getAllPostSlugs()
    .map((slug) => readPost(slug).meta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
