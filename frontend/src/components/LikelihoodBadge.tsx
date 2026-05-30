'use client';

import type { Likelihood } from '@/lib/api';

const CONFIG = {
  certain: { label: 'Certain', classes: 'bg-green-600 text-white' },
  high: { label: 'High', classes: 'bg-emerald-500 text-white' },
  medium: { label: 'Medium', classes: 'bg-yellow-400 text-black' },
  low: { label: 'Low', classes: 'bg-orange-500 text-white' },
  impossible: { label: 'Impossible', classes: 'bg-zinc-400 text-white' },
} as const;

interface Props {
  likelihood: Likelihood | null | undefined;
}

export function LikelihoodBadge({ likelihood }: Props) {
  if (!likelihood) return null;
  const cfg = CONFIG[likelihood.label] ?? CONFIG.impossible;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}
