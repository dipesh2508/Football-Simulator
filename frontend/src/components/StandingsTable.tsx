'use client';

import type { StandingEntry } from '@/lib/api';

interface Props {
  standings: StandingEntry[];
  userTeam: string;
}

export function StandingsTable({ standings, userTeam }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2 w-8">#</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-center w-10">P</th>
            <th className="px-3 py-2 text-center w-10">W</th>
            <th className="px-3 py-2 text-center w-10">D</th>
            <th className="px-3 py-2 text-center w-10">L</th>
            <th className="px-3 py-2 text-center w-14">GD</th>
            <th className="px-3 py-2 text-center w-12">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {standings.map((entry, idx) => {
            const isUser = entry.team === userTeam;
            return (
              <tr
                key={entry.team}
                className={
                  isUser
                    ? 'bg-blue-50 font-semibold dark:bg-blue-900/20'
                    : 'bg-white dark:bg-zinc-900'
                }
              >
                <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                <td className="px-3 py-2 text-zinc-900 dark:text-white">
                  {entry.team}
                  {isUser && (
                    <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                      You
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">{entry.played}</td>
                <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">{entry.won}</td>
                <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">{entry.drawn}</td>
                <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">{entry.lost}</td>
                <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">
                  {entry.gd > 0 ? `+${entry.gd}` : entry.gd}
                </td>
                <td className="px-3 py-2 text-center font-bold text-zinc-900 dark:text-white">{entry.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
