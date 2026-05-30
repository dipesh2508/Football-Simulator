'use client';

import { useRouter } from 'next/navigation';
import { useGame, type GamePhase } from '@/context/GameContext';
import { api } from '@/lib/api';
import { useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const { setSession, sessionId, refreshFromServer } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNewGame() {
    setLoading(true);
    setError(null);
    try {
      const { sessionId: id } = await api.createSession();
      setSession(id);
      router.push('/select-team');
    } catch (e: any) {
      setError(e.message ?? 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const session = await api.getSession(sessionId);
      refreshFromServer({
        phase: session.phase as GamePhase,
        userTeam: session.userTeam ?? null,
        userTeamApiId: session.userTeamApiId ?? null,
        budget: session.budget,
        squadCount: session.squad.length,
        currentGameweek: session.currentGameweek,
      });
      if (session.phase === 'team_selection') router.push('/select-team');
      else if (session.phase === 'summer_transfer' || session.phase === 'january_transfer') router.push('/transfers');
      else if (session.phase === 'season') router.push('/season');
      else router.push('/end');
    } catch {
      setError('Could not load saved session — it may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <div className="max-w-lg space-y-6">
        <span className="inline-block rounded-full bg-blue-600 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white">
          Premier League
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Football<br />Simulator
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          Pick your club, navigate two transfer windows, and survive a full 38-gameweek season.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleNewGame}
            disabled={loading}
            className="rounded-xl bg-blue-600 py-3 px-8 text-base font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'New Game'}
          </button>
          {sessionId && (
            <button
              onClick={handleContinue}
              disabled={loading}
              className="rounded-xl border-2 border-zinc-300 py-3 px-8 text-base font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-60"
            >
              Continue Saved Game
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
