"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { LogOut } from "lucide-react";
import {
  IconHome,
  IconMicrophone,
  IconCalendar,
  IconLayoutKanban,
  IconCheckbox,
  IconSettings,
} from "@tabler/icons-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: IconHome },
  { href: "/meetings", label: "Meetings", icon: IconMicrophone },
  { href: "/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/tasks", label: "Tasks", icon: IconLayoutKanban },
  { href: "/todos", label: "Todos", icon: IconCheckbox },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function DashboardNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-[var(--bg-surface)] sm:flex">
      <Link href="/dashboard" className="flex h-16 items-center px-5">
        <Logo size="sm" />
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-sm)] border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "border-l-[var(--blue-primary)] bg-[var(--bg-card)] text-[var(--blue-glow)]"
                  : "border-l-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-border px-4 py-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>
            {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {user.name ?? user.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          title="Sign out"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[var(--bg-surface)]/95 backdrop-blur sm:hidden">
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>
              {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="icon"
            title="Sign out"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium",
                active
                  ? "bg-[var(--bg-card)] text-[var(--blue-glow)]"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
