'use client';

interface Props {
  spent: number;
  total: number;
  remaining: number;
}

export function BudgetBar({ spent, total, remaining }: Props) {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const barColor = remaining < total * 0.15 ? 'bg-red-500' : remaining < total * 0.4 ? 'bg-yellow-400' : 'bg-green-500';

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Budget</span>
        <span className="font-semibold text-zinc-900 dark:text-white">
          £{remaining.toFixed(0)}m remaining
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-zinc-500">
        £{spent.toFixed(0)}m spent of £{total.toFixed(0)}m
      </div>
    </div>
  );
}
