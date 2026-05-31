'use client';

import type { ClubSeasonStats } from '@/lib/api';

interface TeamStatsAccordionProps {
  clubs: ClubSeasonStats[];
  userTeam: string;
}

export function TeamStatsAccordion({ clubs, userTeam }: TeamStatsAccordionProps) {
  if (clubs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">All Players by Team</h3>
        <p className="text-xs text-zinc-500">Full season totals for every squad in the league.</p>
      </div>

      <div className="space-y-3">
        {clubs.map((club) => (
          <details
            key={club.club}
            open={club.club === userTeam}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white">
              <div className="flex items-center justify-between gap-3">
                <span>{club.club}</span>
                <span className="text-xs font-medium text-zinc-500">{club.players.length} players</span>
              </div>
            </summary>
            <div className="overflow-x-auto border-t border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-center">Apps</th>
                    <th className="px-4 py-2 text-center">Gls</th>
                    <th className="px-4 py-2 text-center">Ast</th>
                    <th className="px-4 py-2 text-center">CS</th>
                    <th className="px-4 py-2 text-center">YC</th>
                    <th className="px-4 py-2 text-center">RC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {club.players.map((player) => (
                    <tr
                      key={`${player.playerApiId}-${club.club}`}
                      className={player.club === userTeam ? 'bg-blue-50/70 dark:bg-blue-900/15' : undefined}
                    >
                      <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">{player.playerName}</td>
                      <td className="px-4 py-2 text-center text-zinc-400">{player.appearances}</td>
                      <td className="px-4 py-2 text-center text-zinc-400">{player.goals}</td>
                      <td className="px-4 py-2 text-center text-zinc-400">{player.assists}</td>
                      <td className="px-4 py-2 text-center text-zinc-400">{player.cleanSheets}</td>
                      <td className="px-4 py-2 text-center text-zinc-400">{player.yellowCards}</td>
                      <td className="px-4 py-2 text-center text-zinc-400">{player.redCards}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}