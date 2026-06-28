import { cn } from "@/lib/utils";

const ICON_SIZES = { sm: 24, md: 32, lg: 48 } as const;
const LOCKUP_WIDTHS = { sm: 140, md: 180, lg: 240 } as const;
const LOCKUP_ASPECT_RATIO = 360 / 96;

type LogoProps = {
  variant?: "icon" | "lockup";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Logo({ variant = "lockup", size = "md", className }: LogoProps) {
  if (variant === "icon") {
    const dimension = ICON_SIZES[size];
    return (
      <img
        src="/logo-icon.svg"
        alt="MeetFlhow"
        width={dimension}
        height={dimension}
        className={cn("shrink-0", className)}
      />
    );
  }

  const width = LOCKUP_WIDTHS[size];
  const height = Math.round(width / LOCKUP_ASPECT_RATIO);
  return (
    <img
      src="/logo-lockup.svg"
      alt="MeetFlhow"
      width={width}
      height={height}
      className={cn("shrink-0", className)}
    />
  );
}
