import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface/60 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-10 items-center justify-center text-subtle">
          {icon}
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
