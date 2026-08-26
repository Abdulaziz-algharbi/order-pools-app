import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}

export function ProgressBar({ value, className, trackClassName, barClassName }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", trackClassName, className)}
    >
      <div
        className={cn("h-full rounded-full bg-secondary transition-all", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
