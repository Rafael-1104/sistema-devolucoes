import { statusLabels, type DevolucaoStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const styles: Record<DevolucaoStatus, string> = {
  em_montagem:
    "bg-warning/15 text-warning-foreground border-warning/30 dark:bg-amber-500/10 dark:text-amber-100 dark:border-amber-400/30",
  csv_gerado:
    "bg-info/10 text-info border-info/25 dark:bg-sky-500/10 dark:text-sky-100 dark:border-sky-400/30",
  rm_vinculada:
    "bg-primary/12 text-primary-dark border-primary/25 dark:bg-emerald-500/10 dark:text-emerald-100 dark:border-emerald-400/30",
  finalizada:
    "bg-primary/20 text-primary-dark border-primary/40 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/40",
};

export function StatusBadge({ status }: { status: DevolucaoStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        styles[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
