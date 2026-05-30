'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { getClubLogoWithFallback } from '@/lib/logos';

const BASE_NAV_LINKS = [
  { href: '/squad',    label: 'Squad',    minPhase: null },
  { href: '/lineup',   label: 'Lineup',   minPhase: null },
  { href: '/transfers',label: 'Transfers',minPhase: null },
  { href: '/season',   label: 'Season',   minPhase: 'season' },
  { href: '/teams',    label: 'Teams',    minPhase: 'season' },
  { href: '/standings',label: 'Table',    minPhase: 'season' },
  { href: '/stats',    label: 'Stats',    minPhase: 'season' },
];

const PHASE_ORDER = ['squad_setup', 'summer_transfer', 'season', 'january_transfer', 'season_end'];

function phaseAtLeast(current: string, required: string | null): boolean {
  if (!required) return true;
  return PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(required);
}

export function Navigation() {
  const pathname = usePathname();
  const { userTeam, budget, currentGameweek, phase } = useGame();

  if (!userTeam) return null;

  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left: team + phase */}
        <div className="flex items-center gap-2">
          {(() => {
            const logo = getClubLogoWithFallback(userTeam ?? '');
            return logo ? (
              <img src={logo} alt={userTeam ?? 'Team'} className="w-6 h-6 object-contain" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                {(userTeam ?? 'T').slice(0, 1)}
              </div>
            );
          })()}
          <span className="font-bold text-blue-700 dark:text-blue-400">{userTeam}</span>
          <span className="text-xs text-zinc-500 uppercase">
            {phase.replace('_', ' ')}
            {phase === 'season' ? ` · GW${currentGameweek}` : ''}
          </span>
        </div>

        {/* Centre: nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {BASE_NAV_LINKS.filter((link) => phaseAtLeast(phase, link.minPhase)).map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right: budget */}
        <div className="text-sm font-semibold text-zinc-900 dark:text-white">
          £{budget.toFixed(0)}m
        </div>
      </div>
    </nav>
  );
}
