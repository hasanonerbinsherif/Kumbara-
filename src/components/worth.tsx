import { formatMoney } from "@/lib/money";
import type { Worth } from "@/lib/rates";

/** "+1.2%" / "−0.8%" / "±0%". */
export function formatChange(change: number) {
  const pct = (Math.abs(change) * 100).toFixed(1);
  if (pct === "0.0") return "±0%";
  return `${change > 0 ? "+" : "−"}${pct}%`;
}

/** Today's value with the change since the transaction, for a table cell. */
export function WorthCell({ worth }: { worth: Worth | null }) {
  if (!worth) return <span className="text-pink-800/50 dark:text-pink-200/50">—</span>;
  return (
    <span
      title={`Worth ${formatMoney(worth.then.value, worth.currency)} then (rate of ${worth.then.rateDate}), ${formatMoney(worth.now.value, worth.currency)} today (rate of ${worth.now.rateDate})`}
    >
      {formatMoney(worth.now.value, worth.currency)}{" "}
      <span className="text-xs text-pink-800/70 dark:text-pink-200/70">{formatChange(worth.change)}</span>
    </span>
  );
}
