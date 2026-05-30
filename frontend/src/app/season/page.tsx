'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, SimulateResponse, GoalEvent, SubstitutionEvent } from '@/lib/api';
import { getClubLogoWithFallback } from '@/lib/logos';

function GoalLog({ goals }: { goals: GoalEvent[] }) {
  return (
    <div className="space-y-1 mt-2">
      {goals.map((g, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
          <span className="text-yellow-400 font-bold w-4 text-right">{g.minute}&apos;</span>
          <span>
            {g.isPenalty && <span className="text-orange-400 font-semibold">[P] </span>}
            <span className="font-medium text-white">{g.scorerName}</span>
            {g.assisterName && (
              <span className="text-zinc-400"> (assist: {g.assisterName})</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function SubLog({ subs }: { subs: SubstitutionEvent[] }) {
  if (!subs || subs.length === 0) return null;
  return (
    <div className="space-y-1 mt-2 pt-2 border-t border-zinc-700">
      {subs.map((s, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
          <span className="text-blue-400 font-bold w-4 text-right">{s.minute}&apos;</span>
          <span>
            <span className="text-red-400">↓ {s.playerOffName}</span>
            {' → '}
            <span className="text-emerald-400">↑ {s.playerOnName}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  userTeam,
  defaultExpanded,
}: {
  match: SimulateResponse['matches'][0];
  userTeam: string;
  defaultExpanded?: boolean;
}) {
  const isUser = match.homeTeam === userTeam || match.awayTeam === userTeam;
  const [open, setOpen] = useState(defaultExpanded ?? isUser);

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isUser
          ? 'border-blue-500 bg-blue-950/30'
          : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
      }`}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`flex items-center gap-2 flex-1 text-sm font-semibold text-right truncate ${isUser && match.homeTeam === userTeam ? 'text-blue-300' : 'text-zinc-200'}`}>
          {(() => {
            const logo = getClubLogoWithFallback(match.homeTeam);
            return logo ? (
              <img src={logo} alt={match.homeTeam} className="w-5 h-5 object-contain shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-600 text-[10px] flex items-center justify-center shrink-0 font-semibold text-gray-300">
                {match.homeTeam.slice(0, 1)}
              </div>
            );
          })()}
          {match.homeTeam}
          {match.homeTeam === userTeam && (
            <span className="ml-1.5 text-[10px] bg-blue-600 text-white px-1 py-0.5 rounded font-bold uppercase">YOU</span>
          )}
        </span>
        <span className="mx-3 rounded-lg bg-zinc-800 px-3 py-1 text-base font-bold text-white shrink-0">
          {match.homeScore} – {match.awayScore}
        </span>
        <span className={`flex items-center gap-2 flex-1 text-sm font-semibold truncate ${isUser && match.awayTeam === userTeam ? 'text-blue-300' : 'text-zinc-200'}`}>
          {match.awayTeam === userTeam && (
            <span className="mr-1.5 text-[10px] bg-blue-600 text-white px-1 py-0.5 rounded font-bold uppercase">YOU</span>
          )}
          {match.awayTeam}
          {(() => {
            const logo = getClubLogoWithFallback(match.awayTeam);
            return logo ? (
              <img src={logo} alt={match.awayTeam} className="w-5 h-5 object-contain shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-600 text-[10px] flex items-center justify-center shrink-0 font-semibold text-gray-300">
                {match.awayTeam.slice(0, 1)}
              </div>
            );
          })()}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {match.goals.length > 0 && <GoalLog goals={match.goals} />}
          {match.substitutions && <SubLog subs={match.substitutions} />}
        </div>
      )}
    </div>
  );
}

export default function SeasonPage() {
  const router = useRouter();
  const { sessionId, phase, userTeam, setPhase, setGameweek, currentGameweek } = useGame();

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

  // Find user's match from latest GW results
  const userMatch = gwResults?.matches.find(
    (m) => m.homeTeam === userTeam || m.awayTeam === userTeam
  );

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

      {/* User match banner */}
      {userMatch && (
        <div className={`rounded-xl p-4 text-center ${
          (userMatch.homeTeam === userTeam ? userMatch.homeScore > userMatch.awayScore : userMatch.awayScore > userMatch.homeScore)
            ? 'bg-emerald-900/40 border border-emerald-600'
            : (userMatch.homeScore === userMatch.awayScore)
              ? 'bg-zinc-800 border border-zinc-600'
              : 'bg-red-900/40 border border-red-600'
        }`}>
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1 font-semibold">
            Your Result — GW{gwResults?.gameweek}
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {userMatch.homeScore} – {userMatch.awayScore}
          </div>
          <div className="text-sm text-zinc-300 mt-1">
            {userMatch.homeTeam} vs {userMatch.awayTeam}
          </div>
          <div className="mt-1 font-bold text-lg">
            {(userMatch.homeTeam === userTeam ? userMatch.homeScore > userMatch.awayScore : userMatch.awayScore > userMatch.homeScore)
              ? <span className="text-emerald-400">WIN</span>
              : userMatch.homeScore === userMatch.awayScore
                ? <span className="text-zinc-300">DRAW</span>
                : <span className="text-red-400">LOSS</span>
            }
          </div>
          {gwResults?.userStanding && (
            <div className="text-xs text-zinc-400 mt-1">
              League position: <span className="text-white font-semibold">#{gwResults.userStanding}</span>
            </div>
          )}
        </div>
      )}

      {gwResults && (
        <div className="space-y-2">
          <h2 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm uppercase tracking-wide">
            GW{gwResults.gameweek} Results
          </h2>
          {/* Sort: user match first */}
          {[...gwResults.matches]
            .sort((a, b) => {
              const aIsUser = a.homeTeam === userTeam || a.awayTeam === userTeam;
              const bIsUser = b.homeTeam === userTeam || b.awayTeam === userTeam;
              return aIsUser === bIsUser ? 0 : aIsUser ? -1 : 1;
            })
            .map((m, i) => (
              <MatchCard key={i} match={m} userTeam={userTeam ?? ''} defaultExpanded={false} />
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

