import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { MARKETING_PAGES, marketingPagePath } from "@/lib/marketing-pages";

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
      <nav
        aria-label="Solutions and integrations"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 pt-8 text-xs text-muted-foreground sm:px-8"
      >
        {MARKETING_PAGES.map((page) => (
          <Link
            key={marketingPagePath(page)}
            href={marketingPagePath(page)}
            className="transition-colors hover:text-foreground"
          >
            {page.section === "solutions" ? `For ${page.navLabel.toLowerCase()}` : `${page.navLabel} integration`}
          </Link>
        ))}
      </nav>
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
        <div className="flex flex-col items-center gap-2 sm:items-end">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms of Service
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MeetFlhow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
