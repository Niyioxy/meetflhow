"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";

export function DashboardTopbar() {
  return (
    <div className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-[var(--bg-surface)]/95 px-6 backdrop-blur sm:ml-60 sm:flex">
      <NotificationBell />
    </div>
  );
}
