'use client';

import type { PlayerSeasonStats } from '@/lib/api';

interface StatTableProps {
  title: string;
  players: PlayerSeasonStats[];
  statKey: keyof Pick<PlayerSeasonStats, 'goals' | 'assists' | 'cleanSheets'>;
  statLabel: string;
  userTeam: string;
}

export function StatTable({ title, players, statKey, statLabel, userTeam }: StatTableProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2 w-8">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Club</th>
              <th className="px-3 py-2 text-center">{statLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {players.map((p, idx) => {
              const isUser = p.club === userTeam;
              return (
                <tr
                  key={p.playerApiId}
                  className={isUser ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-zinc-900'}
                >
                  <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{p.playerName}</td>
                  <td className="px-3 py-2 text-zinc-500">{p.club}</td>
                  <td className="px-3 py-2 text-center font-bold text-zinc-900 dark:text-white">{p[statKey]}</td>
                </tr>
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-zinc-400">No data yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
