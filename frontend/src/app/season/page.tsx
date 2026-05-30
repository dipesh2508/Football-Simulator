'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, SimulateResponse } from '@/lib/api';

function MatchCard({ match }: { match: SimulateResponse['matches'][0]; userTeam: string }) {
  const isUserHome = false; // determined by parent
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <span className="flex-1 text-sm font-medium text-right text-zinc-800 dark:text-zinc-200 truncate">
        {match.homeTeam}
      </span>
      <span className="mx-4 rounded-lg bg-zinc-900 px-3 py-1 text-base font-bold text-white dark:bg-zinc-700">
        {match.homeScore} – {match.awayScore}
      </span>
      <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
        {match.awayTeam}
      </span>
    </div>
  );
}

export default function SeasonPage() {
  const router = useRouter();
  const { sessionId, phase, setPhase, setGameweek, currentGameweek } = useGame();

  const [gwResults, setGwResults] = useState<SimulateResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simAll, setSimAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    if (phase === 'team_selection') { router.replace('/select-team'); return; }
    if (phase === 'summer_transfer' || phase === 'january_transfer') { router.replace('/transfers'); return; }
    if (phase === 'season_end') { router.replace('/end'); }
  }, [sessionId, phase, router]);

  async function handleSimulateGW() {
    if (!sessionId) return;
    setSimulating(true);
    setError(null);
    try {
      const res = await api.simulateGameweek(sessionId);
      setGwResults(res);
      setGameweek(res.gameweek);
      setPhase(res.phase as any);
      if (res.phase === 'january_transfer') router.push('/transfers');
      if (res.phase === 'season_end') router.push('/end');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSimulating(false);
    }
  }

  async function handleSimAll() {
    if (!sessionId) return;
    setSimAll(true);
    setError(null);
    try {
      const res = await api.simulateAll(sessionId);
      setGameweek(res.simulatedUpTo);
      setPhase(res.phase as any);
      if (res.phase === 'january_transfer') router.push('/transfers');
      if (res.phase === 'season_end') router.push('/end');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSimAll(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Season</h1>
          <p className="text-sm text-zinc-500">Gameweek {currentGameweek} / 38</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSimulateGW}
            disabled={simulating || simAll || currentGameweek >= 38}
            className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {simulating ? 'Simulating…' : `Simulate GW${currentGameweek + 1}`}
          </button>
          <button
            onClick={handleSimAll}
            disabled={simulating || simAll || currentGameweek >= 38}
            className="rounded-xl bg-zinc-700 px-5 py-2.5 font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {simAll ? 'Simulating…' : 'Sim All'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {gwResults && (
        <div className="space-y-3">
          <h2 className="font-bold text-zinc-700 dark:text-zinc-300">GW{gwResults.gameweek} Results</h2>
          {gwResults.matches.map((m, i) => (
            <MatchCard key={i} match={m} userTeam="" />
          ))}
        </div>
      )}

      {/* Quick nav */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={() => router.push('/standings')}
          className="flex-1 rounded-xl border border-zinc-300 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          View Table
        </button>
        <button
          onClick={() => router.push('/stats')}
          className="flex-1 rounded-xl border border-zinc-300 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Season Stats
        </button>
      </div>
    </div>
  );
}
