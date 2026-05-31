'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { api, Player } from '@/lib/api';
import { PlayerCard } from '@/components/PlayerCard';
import { BudgetBar } from '@/components/BudgetBar';

export default function TransfersPage() {
  const router = useRouter();
  const { sessionId, phase, budget, setBudget, setPhase } = useGame();

  const [marketPlayers, setMarketPlayers] = useState<Player[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [totalBudget] = useState(budget);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMarket = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const maxPriceForFilter = onlyAffordable ? budget : (maxPrice ? parseFloat(maxPrice) : undefined);
      const res = await api.getTransferMarket(sessionId, {
        page,
        limit: 18,
        search: search || undefined,
        position: posFilter || undefined,
        league: leagueFilter || undefined,
        minValue: minPrice ? parseFloat(minPrice) : undefined,
        maxValue: maxPriceForFilter,
      });
      setMarketPlayers(res.players);
      setTotalPages(res.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [sessionId, page, search, posFilter, leagueFilter, minPrice, maxPrice, onlyAffordable, budget]);

  const fetchSquad = useCallback(async () => {
    if (!sessionId) return;
    const session = await api.getSession(sessionId);
    setSquadPlayers(session.squad as Player[]);
    setBudget(session.budget);
  }, [sessionId, setBudget]);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    if (phase !== 'summer_transfer' && phase !== 'january_transfer') { router.replace('/season'); return; }
    fetchSquad();
  }, [sessionId, phase, router, fetchSquad]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  async function handleBuy(player: Player) {
    if (!sessionId) return;
    try {
      const res = await api.buyPlayer(sessionId, player._id);
      if (res.success) {
        showToast(`✓ ${player.shortName} signed!`, true);
        setBudget(res.budget!);
        await fetchMarket();
        await fetchSquad();
      } else {
        showToast(`✗ ${res.message}`, false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    }
  }

  async function handleSell(player: Player) {
    if (!sessionId) return;
    try {
      const res = await api.sellPlayer(sessionId, player._id);
      showToast(res.message, true);
      setBudget(res.budget);
      await fetchMarket();
      await fetchSquad();
    } catch (e: any) {
      showToast(e.message, false);
    }
  }

  async function handleConfirm() {
    if (!sessionId) return;
    setConfirming(true);
    try {
      const res = await api.confirmTransferWindow(sessionId);
      setPhase(res.nextPhase as any);
      router.push('/season');
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setConfirming(false);
    }
  }

  const spent = totalBudget - budget;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
          {phase === 'summer_transfer' ? 'Summer' : 'January'} Transfer Window
        </h1>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {confirming ? 'Processing…' : 'Close Window & Start Season'}
        </button>
      </div>

      <BudgetBar spent={spent} total={totalBudget} remaining={budget} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Squad panel */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Your Squad ({squadPlayers.length})</h2>
          {squadPlayers.length === 0 ? (
            <p className="text-sm text-zinc-400">No players yet</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {squadPlayers.map((p) => (
                <PlayerCard
                  key={p._id}
                  player={p}
                  actionLabel="Sell"
                  onAction={handleSell}
                  showSellPrice
                />
              ))}
            </div>
          )}
        </div>

        {/* Market panel */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Transfer Market</h2>
          {/* Filters */}
          <div className="space-y-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {/* Search and Positions Row */}
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Search player…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <select
                value={posFilter}
                onChange={(e) => { setPosFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">All Positions</option>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
              <select
                value={leagueFilter}
                onChange={(e) => { setLeagueFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">All Leagues</option>
                <option value="Premier League">Premier League</option>
                <option value="La Liga">La Liga</option>
                <option value="Serie A">Serie A</option>
                <option value="Bundesliga">Bundesliga</option>
                <option value="Ligue 1">Ligue 1</option>
              </select>
            </div>

            {/* Price Range Row */}
            <div className="flex gap-2 flex-wrap items-center">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Price Range (M):</label>
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                className="w-20 rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <span className="text-zinc-400">—</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                className="w-20 rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <label className="flex items-center gap-2 ml-auto cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyAffordable}
                  onChange={(e) => {
                    setOnlyAffordable(e.target.checked);
                    if (e.target.checked) setMaxPrice('');
                    setPage(1);
                  }}
                  className="rounded"
                />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Only Affordable</span>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Loading players…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {marketPlayers.map((p) => (
                  <PlayerCard
                    key={p._id}
                    player={p}
                    actionLabel={p.marketValue <= budget ? 'Sign' : 'Too Expensive'}
                    actionDisabled={p.marketValue > budget}
                    onAction={handleBuy}
                    showLikelihood
                  />
                ))}
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border px-4 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
                >
                  ← Prev
                </button>
                <span className="text-sm text-zinc-500">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border px-4 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
