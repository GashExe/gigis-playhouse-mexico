import { cn } from "@/lib/utils";
import { initials, avatarHue } from "@/lib/utils";

const sizeMap = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const hue = avatarHue(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[30%] font-semibold tracking-tight",
        sizeMap[size],
        className,
      )}
      style={{
        backgroundColor: `oklch(0.935 0.035 ${hue})`,
        color: `oklch(0.42 0.08 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}
