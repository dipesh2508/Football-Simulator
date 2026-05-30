'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGame } from '@/context/GameContext';

const NAV_LINKS = [
  { href: '/squad',    label: 'Squad' },
  { href: '/lineup',   label: 'Lineup' },
  { href: '/transfers',label: 'Transfers' },
  { href: '/season',   label: 'Season' },
  { href: '/standings',label: 'Table' },
  { href: '/stats',    label: 'Stats' },
];

export function Navigation() {
  const pathname = usePathname();
  const { userTeam, budget, currentGameweek, phase } = useGame();

  if (!userTeam) return null;

  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left: team + phase */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-blue-700 dark:text-blue-400">{userTeam}</span>
          <span className="text-xs text-zinc-500 uppercase">
            {phase.replace('_', ' ')}
            {phase === 'season' ? ` · GW${currentGameweek}` : ''}
          </span>
        </div>

        {/* Centre: nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
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
