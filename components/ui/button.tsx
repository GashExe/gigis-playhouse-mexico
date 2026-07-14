import Link from "next/link";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none " +
  "rounded-[var(--radius-control)] transition-[background,color,box-shadow,transform] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-brand shadow-[var(--shadow-sm)] hover:bg-primary-hover",
  accent:
    "bg-accent text-ink shadow-[var(--shadow-sm)] hover:brightness-105",
  secondary:
    "bg-surface text-ink border border-border-strong hover:bg-surface-2 hover:border-border-strong",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-danger text-on-brand shadow-[var(--shadow-sm)] hover:bg-danger-strong",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.ComponentProps<typeof Link>, keyof CommonProps> & {
    href: string;
  };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", loading, className, children } = props;
  const classes = cn(base, variants[variant], sizes[size], className);

  if ("href" in props && props.href !== undefined) {
    const { variant: _v, size: _s, loading: _l, className: _c, children: _ch, ...rest } =
      props as ButtonAsLink;
    return (
      <Link className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, loading: _l, className: _c, children: _ch, disabled, ...rest } =
    props as ButtonAsButton;
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <CircleNotch weight="bold" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
