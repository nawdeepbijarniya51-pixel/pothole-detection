import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  ready: boolean;
  label?: string;
}

export function StatusBadge({ ready, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-sm px-3 py-1 font-mono text-xs font-semibold tracking-wider uppercase border",
        ready
          ? "border-neon-green/40 text-neon-green glow-green"
          : "border-muted-foreground/30 text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          ready ? "bg-neon-green animate-pulse-glow" : "bg-muted-foreground"
        )}
      />
      {label || (ready ? "Model Ready" : "No Model")}
    </span>
  );
}
