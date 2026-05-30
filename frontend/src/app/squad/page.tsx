'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useGame } from '@/context/GameContext';
import { api, Player, PlayerSeasonStats } from '@/lib/api';
import { getClubLogoWithFallback } from '@/lib/logos';
import { PlayerCard } from '@/components/PlayerCard';
import { BudgetBar } from '@/components/BudgetBar';

const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'] as const;

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center min-w-[2rem]">
      <span className="text-xs font-bold text-zinc-900 dark:text-white">{value}</span>
      <span className="text-[10px] text-zinc-400 uppercase leading-none">{label}</span>
    </div>
  );
}

export default function SquadPage() {
  const router = useRouter();
  const { sessionId, budget, userTeam, phase } = useGame();
  const [squad, setSquad] = useState<Player[]>([]);
  const [statsMap, setStatsMap] = useState<Map<number, PlayerSeasonStats>>(new Map());
  const [totalBudget] = useState(budget);
  const [loading, setLoading] = useState(true);

  const inSeason =
    phase === 'season' || phase === 'january_transfer' || phase === 'season_end';

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    const fetches: Promise<void>[] = [
      api.getSession(sessionId).then((s) => { setSquad(s.squad as Player[]); }),
    ];
    if (inSeason) {
      fetches.push(
        api.getStats(sessionId).then((res) => {
          const map = new Map<number, PlayerSeasonStats>();
          [...res.topScorers, ...res.topAssists, ...res.topCleanSheets].forEach((s) => {
            map.set(s.playerApiId, s);
          });
          setStatsMap(map);
        })
      );
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [sessionId, router, inSeason]);

  const byPosition = POSITION_ORDER.map((pos) => ({
    pos,
    players: squad.filter((p) => p.positionGroup === pos),
  }));

  const isTransferWindow = phase === 'summer_transfer' || phase === 'january_transfer';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {(() => {
            const logo = getClubLogoWithFallback(userTeam ?? '');
            return logo ? (
              <Image
                src={logo}
                alt={userTeam ?? 'Team'}
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-lg">
                {(userTeam ?? 'T').slice(0, 1)}
              </div>
            );
          })()}
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">{userTeam}</h1>
            <p className="text-sm text-zinc-500">{squad.length} players</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/lineup')}
            className="rounded-xl bg-zinc-700 px-5 py-2 font-semibold text-white hover:bg-zinc-800 transition"
          >
            Manage Lineup
          </button>
          {isTransferWindow && (
            <button
              onClick={() => router.push('/transfers')}
              className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 transition"
            >
              Transfer Market
            </button>
          )}
        </div>
      </div>

      <BudgetBar spent={totalBudget - budget} total={totalBudget} remaining={budget} />

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Loading squad…</div>
      ) : (
        <div className="space-y-6">
          {byPosition.map(({ pos, players }) =>
            players.length > 0 ? (
              <div key={pos} className="space-y-2">
                <h2 className="font-semibold text-zinc-600 dark:text-zinc-400 uppercase text-sm tracking-wide">
                  {pos}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {players.map((p) => {
                    const stats = statsMap.get(p.apiId);
                    return (
                      <div key={p._id} className="flex flex-col">
                        <PlayerCard player={p} />
                        {inSeason && (
                          <div className="flex gap-3 justify-center mt-1 px-2 py-1 bg-zinc-800/50 rounded-b-xl border-x border-b border-zinc-700">
                            <StatPill label="Apps" value={stats?.appearances ?? 0} />
                            <StatPill label="Gls" value={stats?.goals ?? 0} />
                            <StatPill label="Ast" value={stats?.assists ?? 0} />
                            {(pos === 'GK' || pos === 'DEF') && (
                              <StatPill label="CS" value={stats?.cleanSheets ?? 0} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
