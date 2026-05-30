'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, StatsResponse } from '@/lib/api';
import { StatTable } from '@/components/StatTable';

export default function StatsPage() {
  const router = useRouter();
  const { sessionId, userTeam } = useGame();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    api.getStats(sessionId).then(setData).finally(() => setLoading(false));
  }, [sessionId, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Season Statistics</h1>
        <p className="text-sm text-zinc-500">After GW{data?.currentGameweek ?? 0}</p>
      </div>
      {loading || !data ? (
        <div className="text-center py-12 text-zinc-400">Loading stats…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <StatTable
            title="Top Scorers"
            players={data.topScorers}
            statKey="goals"
            statLabel="Goals"
            userTeam={userTeam ?? ''}
          />
          <StatTable
            title="Top Assists"
            players={data.topAssists}
            statKey="assists"
            statLabel="Assists"
            userTeam={userTeam ?? ''}
          />
          <StatTable
            title="Most Clean Sheets"
            players={data.topCleanSheets}
            statKey="cleanSheets"
            statLabel="CS"
            userTeam={userTeam ?? ''}
          />
        </div>
      )}
    </div>
  );
}
