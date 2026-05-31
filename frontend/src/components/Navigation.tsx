'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
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

function NavItems({
  phase,
  pathname,
  onNavigate,
}: {
  phase: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {BASE_NAV_LINKS.filter((link) => phaseAtLeast(phase, link.minPhase)).map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { userTeam, budget, currentGameweek, phase } = useGame();
  const [mobileOpen, setMobileOpen] = useState(false);
  const portalRoot = typeof document === 'undefined' ? null : document.body;

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  if (!userTeam) return null;

  const mobileSheet =
    mobileOpen && portalRoot
      ? createPortal(
          <div className="fixed inset-0 z-50 sm:hidden isolate">
            <button
              type="button"
              aria-label="Close navigation overlay"
              className="absolute inset-0 bg-black/70"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-0 overflow-y-auto bg-white p-4 opacity-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)] dark:bg-zinc-950">
              <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500">Navigation</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{userTeam}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-zinc-500">Phase</span>
                  <span>{phase.replace('_', ' ')}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-zinc-500">Budget</span>
                  <span>£{budget.toFixed(0)}m</span>
                </div>
                {phase === 'season' && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Gameweek</span>
                    <span>GW{currentGameweek}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <NavItems phase={phase} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>,
          portalRoot
        )
      : null;

  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {(() => {
            const logo = getClubLogoWithFallback(userTeam ?? '');
            return logo ? (
              <Image src={logo} alt={userTeam ?? 'Team'} width={24} height={24} className="h-6 w-6 object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                {(userTeam ?? 'T').slice(0, 1)}
              </div>
            );
          })()}
          <span className="font-bold text-blue-700 dark:text-blue-400">{userTeam}</span>
          <span className="hidden text-xs uppercase text-zinc-500 sm:inline">
            {phase.replace('_', ' ')}
            {phase === 'season' ? ` · GW${currentGameweek}` : ''}
          </span>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <NavItems phase={phase} pathname={pathname} />
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">£{budget.toFixed(0)}m</div>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:hidden"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
            <span className="flex h-4 w-4 flex-col justify-between">
              <span className={`block h-0.5 w-full rounded-full bg-current transition ${mobileOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-full rounded-full bg-current transition ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-full rounded-full bg-current transition ${mobileOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </span>
          </button>
        </div>
      </div>

      {mobileSheet}
    </nav>
  );
}
