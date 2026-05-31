'use client';

import Image from 'next/image';
import { LikelihoodBadge } from './LikelihoodBadge';
import type { Player } from '@/lib/api';

interface Props {
  player: Player;
  actionLabel?: string;
  onAction?: (player: Player) => void;
  actionDisabled?: boolean;
  showLikelihood?: boolean;
  showSellPrice?: boolean;
}

const STAT_KEYS: { key: keyof Player['stats']; label: string }[] = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'dribbling', label: 'DRI' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'PHY' },
];

function overallColor(ovr: number) {
  if (ovr >= 85) return 'bg-yellow-400 text-black';
  if (ovr >= 75) return 'bg-green-500 text-white';
  if (ovr >= 65) return 'bg-blue-500 text-white';
  return 'bg-zinc-400 text-white';
}

export function PlayerCard({ player, actionLabel, onAction, actionDisabled, showLikelihood, showSellPrice }: Props) {
  const sellPrice = Math.round(player.marketValue * 0.8 * 10) / 10;

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {player.photoUrl ? (
          <Image
            src={player.photoUrl}
            alt={player.shortName}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover border border-zinc-200"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-500">
            {player.shortName.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-white truncate">{player.shortName}</p>
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-xs text-zinc-500 truncate">{player.position} · {player.club}</p>
            {player.altPositions && player.altPositions.length > 0 && (
              <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-300 px-1 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-400 whitespace-nowrap shrink-0">
                {player.altPositions.join(' · ')}
              </span>
            )}
          </div>
        </div>
        <span className={`rounded px-2 py-0.5 text-sm font-bold ${overallColor(player.stats.overall)}`}>
          {player.stats.overall}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-6 gap-1 text-center">
        {STAT_KEYS.map(({ key, label }) => (
          <div key={key}>
            <div className="text-[10px] text-zinc-500 uppercase">{label}</div>
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{player.stats[key]}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="space-y-0.5">
          <span className="text-zinc-500">
            {showSellPrice ? `Sell: £${sellPrice}m` : `£${player.marketValue}m`}
          </span>
          {player.isFreeAgent && (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              Free Agent
            </span>
          )}
        </div>
        {showLikelihood && <LikelihoodBadge likelihood={player.likelihood} />}
      </div>

      {/* Action button */}
      {actionLabel && onAction && (
        <button
          onClick={() => onAction(player)}
          disabled={actionDisabled}
          className="mt-1 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
