"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import type { Locale } from "@/i18n/config";

export function DashboardTopbar({ locale }: { locale: Locale }) {
  return (
    <div className="sticky top-0 z-20 hidden h-14 items-center justify-end gap-1 border-b border-border bg-[var(--bg-surface)]/95 px-6 backdrop-blur sm:ml-60 sm:flex">
      <LanguageSwitcher currentLocale={locale} />
      <NotificationBell />
    </div>
  );
}
