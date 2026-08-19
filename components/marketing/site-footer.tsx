import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row sm:px-8">
        <Link href="/">
          <Logo size="sm" />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="transition-colors hover:text-foreground">
            Log in
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} MeetFlhow. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
