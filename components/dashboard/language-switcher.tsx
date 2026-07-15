"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, localeNames, localeCookieName, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locale, setLocale] = useState(currentLocale);

  async function handleSelect(next: Locale) {
    if (next === locale) return;
    const previous = locale;
    setLocale(next);

    try {
      const res = await fetch("/api/user/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: next }),
      });
      if (!res.ok) throw new Error();

      document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000`;
      startTransition(() => router.refresh());
    } catch {
      setLocale(previous);
      toast.error("Failed to update language");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} title="Language">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => handleSelect(l)}
            data-variant={l === locale ? "default" : undefined}
            className={l === locale ? "font-semibold text-[var(--blue-glow)]" : undefined}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
