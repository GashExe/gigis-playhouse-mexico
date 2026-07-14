import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  primary: "bg-primary-weak text-primary-strong border-transparent",
  accent: "bg-accent-weak text-accent-strong border-transparent",
  success: "bg-success-weak text-success-strong border-transparent",
  warning: "bg-warning-weak text-warning-strong border-transparent",
  danger: "bg-danger-weak text-danger-strong border-transparent",
  info: "bg-info-weak text-info border-transparent",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold leading-5",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
