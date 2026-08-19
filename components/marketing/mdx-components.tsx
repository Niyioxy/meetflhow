import type { MDXComponents } from "mdx/types";

export const mdxComponents: MDXComponents = {
  h2: (props) => <h2 className="mt-12 mb-4 text-2xl font-semibold tracking-tight" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold tracking-tight" {...props} />,
  p: (props) => <p className="mb-4 leading-relaxed text-foreground/90" {...props} />,
  ul: (props) => <ul className="mb-4 ml-6 list-disc space-y-2" {...props} />,
  ol: (props) => <ol className="mb-4 ml-6 list-decimal space-y-2" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: (props) => (
    <a
      className="text-[var(--blue-light)] underline underline-offset-4 hover:no-underline"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-2 border-border pl-4 text-muted-foreground italic" {...props} />
  ),
  code: (props) => (
    <code className="rounded bg-[var(--bg-card-hover)] px-1.5 py-0.5 text-sm" {...props} />
  ),
  hr: (props) => <hr className="my-10 border-border" {...props} />,
};
