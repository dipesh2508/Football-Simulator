'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, StandingEntry } from '@/lib/api';
import { StandingsTable } from '@/components/StandingsTable';
import { getClubLogoWithFallback } from '@/lib/logos';

export default function StandingsPage() {
  const router = useRouter();
  const { sessionId, userTeam } = useGame();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [gw, setGw] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    api.getStandings(sessionId).then((res) => {
      setStandings(res.standings);
      setGw(res.currentGameweek);
    }).finally(() => setLoading(false));
  }, [sessionId, router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Premier League Table</h1>
        <p className="text-sm text-zinc-500">After GW{gw}</p>
      </div>
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Loading standings…</div>
      ) : (
        <StandingsTable standings={standings} userTeam={userTeam ?? ''} getLogoFn={getClubLogoWithFallback} />
      )}
    </div>
  );
}
