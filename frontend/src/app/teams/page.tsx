'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useGame } from '@/context/GameContext';
import { api, TeamSquadInfo } from '@/lib/api';
import { getClubLogoWithFallback } from '@/lib/logos';

function StrengthBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value);
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 70 ? 'bg-yellow-400' : pct >= 60 ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-7 text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-gray-300 font-mono">{pct}</span>
    </div>
  );
}

function TeamCard({ team }: { team: TeamSquadInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-colors cursor-pointer select-none ${
        team.isUserClub
          ? 'border-emerald-500 bg-gray-800/70'
          : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'
      }`}
      onClick={() => setOpen((v) => !v)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        {(() => {
          const logo = getClubLogoWithFallback(team.clubName);
          return logo ? (
            <Image
              src={logo}
              alt={team.clubName}
              width={40}
              height={40}
              className="w-10 h-10 object-contain shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0 font-semibold">
              {team.clubName.slice(0, 2).toUpperCase()}
            </div>
          );
        })()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{team.clubName}</span>
            {team.promoted && (
              <span className="shrink-0 bg-amber-500/20 text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded">
                🏆 Promoted
              </span>
            )}
            {team.isUserClub && (
              <span className="shrink-0 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-1.5 py-0.5 rounded">
                YOU
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{team.squadSize} players</div>
        </div>

        {/* Overall badge */}
        <div className="text-center shrink-0">
          <div className="text-2xl font-bold text-white">{Math.round(team.strengthScore.overall)}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">OVR</div>
        </div>
      </div>

      {/* Strength bars */}
      <div className="px-4 pb-4 space-y-1.5">
        <StrengthBar label="ATT" value={team.strengthScore.attack} />
        <StrengthBar label="MID" value={team.strengthScore.midfield} />
        <StrengthBar label="DEF" value={team.strengthScore.defence} />
      </div>

      {/* Best XI (expandable) */}
      {open && (
        <div className="border-t border-gray-700 px-4 py-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Best XI</div>
          <div className="grid grid-cols-1 gap-1">
            {team.bestXI.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-xs text-gray-500 font-mono text-right shrink-0">{p.position}</span>
                <span className="flex-1 text-gray-200 truncate">{p.name}</span>
                <span className="text-yellow-400 font-bold text-xs shrink-0">{p.overall}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  const { sessionId, phase } = useGame();
  const [teams, setTeams] = useState<TeamSquadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    api
      .getTeamsSquads(sessionId)
      .then((data) => setTeams(data.teams))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        No active session.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 animate-pulse">
        Loading teams...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">All Teams</h1>
        <p className="text-gray-400 text-sm mb-6">
          Premier League squads after the transfer window — click a card to see Best XI
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamCard key={team.clubApiId} team={team} />
          ))}
        </div>
      </div>
    </div>
  );
}
