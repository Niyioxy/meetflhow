import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  style,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" };
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in-up flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-light)] hover:shadow-[var(--shadow-card-hover)]",
        className
      )}
      style={style}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-[var(--text-secondary)]" />}
      </div>
      <span className="text-3xl font-bold tabular-nums text-[var(--blue-glow)]">{value}</span>
      {trend && (
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend.direction === "up" ? "text-[var(--green)]" : "text-[var(--red)]"
          )}
        >
          {trend.direction === "up" ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {trend.value}
        </span>
      )}
    </div>
  );
}
