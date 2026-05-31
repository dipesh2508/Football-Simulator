'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, StandingEntry, StatsResponse } from '@/lib/api';
import { getClubLogoWithFallback } from '@/lib/logos';
import { StandingsTable } from '@/components/StandingsTable';
import { StatTable } from '@/components/StatTable';

export default function EndPage() {
  const router = useRouter();
  const { sessionId, userTeam, clearSession } = useGame();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    Promise.all([api.getStandings(sessionId), api.getStats(sessionId)]).then(([s, st]) => {
      setStandings(s.standings);
      setStats(st);
    }).finally(() => setLoading(false));
  }, [sessionId, router]);

  const userPosition = standings.findIndex((s) => s.team === userTeam) + 1;
  const userEntry = standings.find((s) => s.team === userTeam);

  function handleNewGame() {
    clearSession();
    router.push('/');
  }

  const positionLabel = () => {
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${userPosition}${suffixes[userPosition] ?? 'th'}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      {loading ? (
        <div className="text-center py-16 text-zinc-400">Loading season summary…</div>
      ) : (
        <>
          {/* Hero */}
          <div className="rounded-2xl bg-linear-to-br from-blue-600 to-blue-800 p-8 text-white text-center space-y-2">
            <p className="text-sm font-semibold uppercase tracking-widest opacity-80">Season Complete</p>
            <h1 className="text-4xl font-extrabold">{userTeam}</h1>
            {userEntry && (
              <>
                <p className="text-5xl font-black">{positionLabel()} Place</p>
                <p className="text-lg opacity-80">
                  {userEntry.points} pts · {userEntry.gf} scored · {userEntry.ga} conceded
                </p>
              </>
            )}
          </div>

          {/* Final table */}
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Final Premier League Table</h2>
            <StandingsTable standings={standings} userTeam={userTeam ?? ''} getLogoFn={getClubLogoWithFallback} />
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatTable title="Top Scorers" players={stats.topScorers} statKey="goals" statLabel="Goals" userTeam={userTeam ?? ''} />
              <StatTable title="Top Assists" players={stats.topAssists} statKey="assists" statLabel="Assists" userTeam={userTeam ?? ''} />
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handleNewGame}
              className="rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg hover:bg-blue-700 transition"
            >
              Play Again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
