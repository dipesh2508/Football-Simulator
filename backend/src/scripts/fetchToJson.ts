/**
 * fetchToJson.ts
 *
 * Fetches real player data from v3.football.api-sports.io and writes it to
 * src/data/players.seed.json — ready for manual editing before seeding the DB.
 *
 * Strategy: fetches by TEAM (not by league) to avoid the free-plan page-3 limit.
 *   Each team has ~20-25 players (1-2 pages max), so page 4 is never hit.
 *   56 clubs × ~1.5 pages avg ≈ 84 requests — fits in a single run on the free plan.
 *
 * Free plan note: season=2024 is the latest available. Change to 2025 for paid plans.
 * Free plan limits: 100 req/day, 10 req/min. Progress is saved per club so you can
 *   safely interrupt and re-run.
 *
 * Usage:
 *   npm run fetch-to-json
 *   npm run fetch-to-json -- --reset   (clear progress + output, start fresh)
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { ApiFootballPlayer, Position, PositionGroup } from '@/types/game.types';
import seedData from '@/data/clubs.seed.json';
import affinityOverrides from '@/data/affinity-overrides.json';

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
// Free plan: 2022–2024 only. Change to 2025 with a paid plan.
const SEASON = 2024;
const PROGRESS_FILE = path.join(__dirname, '../data/.fetch-progress.json');
const OUTPUT_FILE = path.join(__dirname, '../data/players.seed.json');

const DELAY_BETWEEN_REQUESTS_MS = 6500; // 10 req/min safe margin
const MAX_REQUESTS_PER_RUN = 95; // 56 clubs × ~1.5 pages ≈ 84 total; fits in one day

// ─── Types ───────────────────────────────────────────────────────────────────

interface FetchProgress {
  completedClubs: number[];               // clubApiIds fully processed
  completedPages: Record<number, number>; // clubApiId -> last completed page
  totalFetched: number;
  lastRun: string;
}

interface ClubEntry {
  name: string;
  apiId: number;
  league: string;
}

export interface PlayerSeedEntry {
  apiId: number;
  name: string;
  nationality: string;
  club: string;
  clubApiId: number;
  league: string;
  position: Position;
  positionGroup: PositionGroup;
  age: number;
  marketValue: number;
  wage?: number; // weekly GBP (populated by parseFC26ToJson)
  contractExpiry?: number; // year contract expires, e.g. 2028
  photoUrl: string;
  affinityClubs: string[];
  antiAffinityClubs: string[];
  isFreeAgent: boolean;
  stats: {
    overall: number;
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadProgress(): FetchProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE))
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {}
  return { completedClubs: [], completedPages: {}, totalFetched: 0, lastRun: '' };
}

function saveProgress(p: FetchProgress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function loadOutput(): PlayerSeedEntry[] {
  try {
    if (fs.existsSync(OUTPUT_FILE))
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  } catch {}
  return [];
}

function saveOutput(players: PlayerSeedEntry[]): void {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(players, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiGet(endpoint: string): Promise<any> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY is not set in .env');
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${BASE_URL}${endpoint}`);
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length > 0)
    throw new Error(`API error: ${JSON.stringify(data.errors)}`);
  return data;
}

// ─── Stat derivation ──────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function mapPositionGroup(positionStr: string): PositionGroup {
  const p = positionStr.toLowerCase();
  if (p.includes('goalkeeper')) return 'GK';
  if (p.includes('defender')) return 'DEF';
  if (p.includes('midfielder')) return 'MID';
  return 'FWD';
}

function mapPosition(positionStr: string, positionGroup: PositionGroup): Position {
  const pos = positionStr.toLowerCase();
  if (positionGroup === 'GK') return 'GK';
  if (positionGroup === 'DEF') {
    if (pos.includes('left')) return 'LB';
    if (pos.includes('right')) return 'RB';
    return 'CB';
  }
  if (positionGroup === 'MID') {
    if (pos.includes('attacking') || pos.includes('cam')) return 'CAM';
    if (pos.includes('defensive') || pos.includes('cdm')) return 'CDM';
    if (pos.includes('left')) return 'LW';
    if (pos.includes('right')) return 'RW';
    return 'CM';
  }
  if (pos.includes('left')) return 'LW';
  if (pos.includes('right')) return 'RW';
  return 'ST';
}

function deriveStats(
  apiPlayer: ApiFootballPlayer,
  positionGroup: PositionGroup
): PlayerSeedEntry['stats'] {
  const stats = apiPlayer.statistics[0];
  const apps = Math.max(stats.games.appearences || 1, 1);
  const rating = parseFloat(stats.games.rating || '6.5');
  const overall = clamp(rating * 10, 50, 95);

  const paceDefaults: Record<PositionGroup, number> = { GK: 38, DEF: 60, MID: 68, FWD: 75 };
  const pace = clamp(paceDefaults[positionGroup] + (Math.floor(Math.random() * 14) - 7), 30, 90);

  const goals = stats.goals.total ?? 0;
  const shotsTotal = Math.max(stats.shots?.total ?? 1, 1);
  const shotsOn = stats.shots?.on ?? 0;
  const shooting =
    positionGroup === 'GK'
      ? 30
      : clamp((goals / apps) * 250 + (shotsOn / shotsTotal) * 40 + 40, 35, 95);

  const passAcc = stats.passes?.accuracy ?? 70;
  const keyPassesPerGame = (stats.passes?.key ?? 0) / apps;
  const passing = clamp(passAcc * 0.65 + keyPassesPerGame * 40 + 15, 40, 95);

  const dribAttempts = stats.dribbles?.attempts ?? 0;
  const dribSuccess = stats.dribbles?.success ?? 0;
  const dribRate = dribAttempts > 0 ? dribSuccess / dribAttempts : 0.5;
  const dribbling =
    positionGroup === 'GK'
      ? 35
      : clamp(dribRate * 60 + (dribAttempts / apps) * 8 + 35, 35, 95);

  const tackles = stats.tackles?.total ?? 0;
  const interceptions = stats.tackles?.interceptions ?? 0;
  const blocks = stats.tackles?.blocks ?? 0;
  const defActions = (tackles + interceptions + blocks) / apps;
  const defending =
    positionGroup === 'GK'
      ? clamp(passing - 5, 35, 75)
      : clamp(defActions * 12 + 35, 30, 95);

  const duelsTotal = Math.max(stats.duels?.total ?? 1, 1);
  const duelsWon = stats.duels?.won ?? 0;
  const physical = clamp((duelsWon / duelsTotal) * 60 + (duelsTotal / apps) * 3 + 35, 35, 90);

  return { overall, pace, shooting, passing, dribbling, defending, physical };
}

function estimateMarketValue(
  overall: number,
  age: number,
  positionGroup: PositionGroup
): number {
  if (overall < 55) return 1;
  let ageFactor: number;
  if (age <= 21) ageFactor = 0.7;
  else if (age <= 23) ageFactor = 0.9;
  else if (age <= 26) ageFactor = 1.0;
  else if (age <= 29) ageFactor = 0.75;
  else if (age <= 31) ageFactor = 0.45;
  else ageFactor = 0.2;
  const positionFactor: Record<PositionGroup, number> = {
    FWD: 1.2,
    MID: 1.0,
    DEF: 0.85,
    GK: 0.7,
  };
  const base = Math.pow(overall - 55, 1.8) * 0.15;
  return Math.max(0.5, Math.round(base * ageFactor * positionFactor[positionGroup] * 10) / 10);
}

// ─── Club fetch ───────────────────────────────────────────────────────────────

async function fetchClub(
  clubApiId: number,
  clubName: string,
  leagueName: string,
  progress: FetchProgress,
  allPlayers: PlayerSeedEntry[],
  affinityMap: Map<number, { affinityClubs: string[]; antiAffinityClubs: string[] }>,
  requestsUsed: { count: number }
): Promise<void> {
  // Each team has ~20-25 players → max 2 pages, never hits the free-plan page-3 cap.
  let page = (progress.completedPages[clubApiId] ?? 0) + 1;

  await sleep(DELAY_BETWEEN_REQUESTS_MS);
  if (requestsUsed.count >= MAX_REQUESTS_PER_RUN) {
    console.log('⚠️  Request budget exhausted. Re-run tomorrow.');
    return;
  }

  const firstPage = await apiGet(
    `/players?team=${clubApiId}&season=${SEASON}&page=${page}`
  );
  requestsUsed.count++;

  // Cap at 3 as a safety net; teams in practice never exceed 2 pages.
  const totalPages: number = Math.min(firstPage.paging?.total ?? 1, 3);

  for (let i = 0; i < totalPages - page + 1; i++) {
    if (requestsUsed.count >= MAX_REQUESTS_PER_RUN && i > 0) {
      console.log('⚠️  Hit request budget. Progress saved. Re-run tomorrow.');
      saveProgress(progress);
      saveOutput(allPlayers);
      return;
    }

    const currentPage = page + i;
    const pageData =
      i === 0
        ? firstPage
        : await (async () => {
            await sleep(DELAY_BETWEEN_REQUESTS_MS);
            const d = await apiGet(
              `/players?team=${clubApiId}&season=${SEASON}&page=${currentPage}`
            );
            requestsUsed.count++;
            return d;
          })();

    const apiPlayers: ApiFootballPlayer[] = pageData.response ?? [];

    for (const p of apiPlayers) {
      if (!p.statistics || p.statistics.length === 0) continue;
      const stat = p.statistics[0];
      const posGroup = mapPositionGroup(stat.games.position ?? '');
      const pos = mapPosition(stat.games.position ?? '', posGroup);
      const derivedStats = deriveStats(p, posGroup);
      const marketValue = estimateMarketValue(derivedStats.overall, p.player.age, posGroup);
      const overrides = affinityMap.get(p.player.id);

      const entry: PlayerSeedEntry = {
        apiId: p.player.id,
        name: p.player.name,
        nationality: p.player.nationality ?? '',
        club: clubName,
        clubApiId,
        league: leagueName,
        position: pos,
        positionGroup: posGroup,
        age: p.player.age,
        marketValue,
        photoUrl: p.player.photo ?? '',
        affinityClubs: overrides?.affinityClubs ?? [],
        antiAffinityClubs: overrides?.antiAffinityClubs ?? [],
        isFreeAgent: false,
        stats: derivedStats,
      };

      const existingIdx = allPlayers.findIndex((x) => x.apiId === p.player.id);
      if (existingIdx >= 0) allPlayers[existingIdx] = entry;
      else allPlayers.push(entry);
    }

    progress.completedPages[clubApiId] = currentPage;
    progress.totalFetched = allPlayers.length;
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);
    saveOutput(allPlayers); // write after every page
  }

  if (!progress.completedClubs.includes(clubApiId))
    progress.completedClubs.push(clubApiId);
  saveProgress(progress);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const shouldReset = process.argv.includes('--reset');

  if (shouldReset) {
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);
    console.log('🔄 Progress and output reset');
  }

  if (!API_KEY) {
    console.error('❌ API_FOOTBALL_KEY is not set in .env');
    process.exit(1);
  }

  const clubs = (seedData as any).clubs as ClubEntry[];

  console.log(`🌍 Fetching players by team → ${OUTPUT_FILE}`);
  console.log(`   Season: ${SEASON} | ${clubs.length} clubs | Max requests: ${MAX_REQUESTS_PER_RUN}`);
  console.log(`   Free plan supports seasons 2022–2024. Upgrade to unlock 2025.\n`);

  const affinityMap = new Map<
    number,
    { affinityClubs: string[]; antiAffinityClubs: string[] }
  >();
  (affinityOverrides as any[]).forEach((o) =>
    affinityMap.set(o.playerApiId, {
      affinityClubs: o.affinityClubs,
      antiAffinityClubs: o.antiAffinityClubs,
    })
  );

  const progress = loadProgress();
  const allPlayers = loadOutput();
  const requestsUsed = { count: 0 };

  for (const club of clubs) {
    if (progress.completedClubs.includes(club.apiId)) {
      console.log(`⏭️  ${club.name} (done)`);
      continue;
    }
    if (requestsUsed.count >= MAX_REQUESTS_PER_RUN) {
      console.log('⚠️  Request budget exhausted. Re-run tomorrow.');
      break;
    }

    process.stdout.write(`📋 ${club.name.padEnd(32)} `);
    await fetchClub(
      club.apiId,
      club.name,
      club.league,
      progress,
      allPlayers,
      affinityMap,
      requestsUsed
    );
    const clubPlayers = allPlayers.filter((p) => p.clubApiId === club.apiId).length;
    console.log(`✅ ${clubPlayers} players  [${requestsUsed.count}/${MAX_REQUESTS_PER_RUN} req]`);
  }

  const allDone = progress.completedClubs.length >= clubs.length;

  console.log('\n📊 Summary:');
  console.log(`   Requests used this run : ${requestsUsed.count}`);
  console.log(`   Total players in JSON  : ${allPlayers.length}`);
  console.log(`   Clubs completed        : ${progress.completedClubs.length}/${clubs.length}`);

  if (!allDone) {
    console.log('\n⚠️  Not all clubs fetched yet. Re-run tomorrow to continue.');
    console.log('   Progress : src/data/.fetch-progress.json');
    console.log('   Output   : src/data/players.seed.json');
  } else {
    console.log('\n🎉 All clubs fetched!');
    console.log('   1. Manually edit src/data/players.seed.json if needed.');
    console.log('   2. Run: npm run seed-players');
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  }
}

main().catch((err) => {
  console.error('❌ Fetch failed:', err.message);
  process.exit(1);
});
