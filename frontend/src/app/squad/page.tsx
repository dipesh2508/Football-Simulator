'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, Player } from '@/lib/api';
import { PlayerCard } from '@/components/PlayerCard';
import { BudgetBar } from '@/components/BudgetBar';

const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'] as const;

export default function SquadPage() {
  const router = useRouter();
  const { sessionId, budget, userTeam, phase } = useGame();
  const [squad, setSquad] = useState<Player[]>([]);
  const [totalBudget] = useState(budget);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    api.getSession(sessionId).then((s) => {
      setSquad(s.squad as Player[]);
    }).finally(() => setLoading(false));
  }, [sessionId, router]);

  const byPosition = POSITION_ORDER.map((pos) => ({
    pos,
    players: squad.filter((p) => p.positionGroup === pos),
  }));

  const isTransferWindow = phase === 'summer_transfer' || phase === 'january_transfer';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">{userTeam}</h1>
          <p className="text-sm text-zinc-500">{squad.length} players</p>
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
          {byPosition.map(({ pos, players }) => (
            players.length > 0 && (
              <div key={pos} className="space-y-2">
                <h2 className="font-semibold text-zinc-600 dark:text-zinc-400 uppercase text-sm tracking-wide">{pos}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {players.map((p) => (
                    <PlayerCard key={p._id} player={p} />
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
