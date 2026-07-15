"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Globe, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { locales, localeNames, type Locale } from "@/i18n/config";
import type { TranslatedActionItem, TranslatedTranscriptSegment } from "@/db/schema";

type TargetLanguage = Locale;

// Includes "en" so meetings where speakers switch into another language or
// regional dialect mid-call can be translated back to English on demand.
const targetLanguages = locales;

interface TranslationData {
  summary: string | null;
  transcript_segments: TranslatedTranscriptSegment[];
  action_items: TranslatedActionItem[];
}

export function TranslatableMeetingContent({
  meetingId,
  children,
}: {
  meetingId: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("meetingDetail");
  const tCommon = useTranslations("common");
  const [language, setLanguage] = useState<"original" | TargetLanguage>("original");
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState<Partial<Record<TargetLanguage, TranslationData>>>({});

  const active = language === "original" ? null : cache[language];

  async function handleSelect(next: "original" | TargetLanguage) {
    if (next === "original") {
      setLanguage("original");
      return;
    }

    if (cache[next]) {
      setLanguage(next);
      return;
    }

    setLoading(true);
    setLanguage(next);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_language: next }),
      });
      if (!res.ok) throw new Error();
      const data: TranslationData = await res.json();
      setCache((prev) => ({ ...prev, [next]: data }));
    } catch {
      toast.error("Failed to translate meeting content");
      setLanguage("original");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              {language === "original"
                ? tCommon("original")
                : localeNames[language]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handleSelect("original")}>
              {tCommon("original")}
            </DropdownMenuItem>
            {targetLanguages.map((l) => (
              <DropdownMenuItem key={l} onSelect={() => handleSelect(l)}>
                {localeNames[l]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {language !== "original" && (
        <p className="text-xs text-muted-foreground">{t("translatedNotice")}</p>
      )}

      {language === "original" ? (
        children
      ) : loading ? (
        <div className="flex flex-col gap-6">
          <div className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-card)]" />
          <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-card)]" />
          <div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-card)]" />
        </div>
      ) : active ? (
        <div className="flex flex-col gap-6">
          {active.summary && (
            <Card>
              <CardHeader>
                <CardTitle>{t("summary")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{active.summary}</p>
              </CardContent>
            </Card>
          )}

          {active.action_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("actionItems")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3 text-sm">
                  {active.action_items.map((item, i) => (
                    <li key={i} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0">
                      <span>{item.task}</span>
                      <span className="text-xs text-muted-foreground">
                        {[item.owner, item.deadline].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {active.transcript_segments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("transcript")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {active.transcript_segments.map((seg, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-muted-foreground">{seg.speaker}</p>
                      <p className="text-sm leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
