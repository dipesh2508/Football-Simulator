'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, SeedClub } from '@/lib/api';

export default function SelectTeamPage() {
  const router = useRouter();
  const { sessionId, setTeam, setPhase } = useGame();
  const [clubs, setClubs] = useState<SeedClub[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) router.replace('/');
  }, [sessionId, router]);

  useEffect(() => {
    async function fetchClubs() {
      try {
        const { clubs } = await api.getClubs();
        setClubs(clubs.sort((a, b) => (a.lastSeasonFinish ?? 99) - (b.lastSeasonFinish ?? 99)));
      } catch (e: any) {
        setError(e.message ?? 'Failed to fetch clubs');
      } finally {
        setLoading(false);
      }
    }
    fetchClubs();
  }, []);

  async function handleSelect(clubName: string) {
    if (!sessionId) return;
    setSelecting(clubName);
    setError(null);
    try {
      const res = await api.selectTeam(sessionId, clubName);
      setTeam(clubName, 0, res.budget, res.squadCount);
      setPhase(res.phase as any);
      router.push('/transfers');
    } catch (e: any) {
      setError(e.message ?? 'Failed to select team');
      setSelecting(null);
    }
  }

  const finishLabel = (finish?: number) => {
    if (!finish) return '';
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return ` · ${finish}${suffixes[finish] ?? 'th'} last season`;
  };

  const budgetLabel = (range?: [number, number]) => {
    if (!range) return '';
    return `£${range[0]}–${range[1]}m budget`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">Choose Your Club</h1>
        <p className="text-zinc-500">Your transfer budget is based on last season&apos;s finish position.</p>
      </div>

      {loading ? (
        <div className="text-center text-zinc-500">Loading clubs...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <button
              key={club.name}
              onClick={() => handleSelect(club.name)}
              disabled={!!selecting}
              className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-white">{club.name}</span>
                {selecting === club.name && (
                  <span className="text-xs text-blue-600 font-semibold">Selecting…</span>
                )}
              </div>
              <span className="text-xs text-zinc-500">{club.shortName}{finishLabel(club.lastSeasonFinish)}</span>
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{budgetLabel(club.budgetRange)}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
