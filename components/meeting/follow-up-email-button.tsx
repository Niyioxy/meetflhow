"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { locales, localeNames, type Locale } from "@/i18n/config";

export function FollowUpEmailButton({ meetingId }: { meetingId: string }) {
  const t = useTranslations("followUpEmail");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [language, setLanguage] = useState<Locale>("en");

  async function draft(targetLanguage: Locale) {
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/follow-up-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: targetLanguage }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSubject(data.subject);
      setBody(data.body);
      setReplyTo(data.replyTo ?? null);
      setRecipients((data.recipients ?? []).join(", "));
    } catch {
      toast.error(t("errorDraft"));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    setOpen(true);
    await draft(language);
  }

  async function handleLanguageChange(next: Locale) {
    setLanguage(next);
    await draft(next);
  }

  async function handleSend(when: "now" | "tomorrow_9am") {
    const recipientList = recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      toast.error(t("errorRecipients"));
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/follow-up-email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipientList,
          replyTo,
          subject,
          body,
          when,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errorSend"));
      }

      toast.success(
        when === "now"
          ? t("successNow", { count: recipientList.length })
          : t("successScheduled")
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        📧 {t("button")}
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="follow-up-language">{t("language")}</Label>
          <Select
            value={language}
            onValueChange={(v) => handleLanguageChange(v as Locale)}
            disabled={loading}
          >
            <SelectTrigger id="follow-up-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((l) => (
                <SelectItem key={l} value={l}>
                  {localeNames[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("drafting")}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="follow-up-recipients">{t("recipients")}</Label>
              <Input
                id="follow-up-recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder={t("recipientsPlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="follow-up-subject">{t("subject")}</Label>
              <Input
                id="follow-up-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="follow-up-body">{t("body")}</Label>
              <Textarea
                id="follow-up-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-48"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading || sending}
            onClick={() => handleSend("tomorrow_9am")}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("scheduleTomorrow")}
          </Button>
          <Button disabled={loading || sending} onClick={() => handleSend("now")}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("sendNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
