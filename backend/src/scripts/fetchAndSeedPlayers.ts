/**
 * fetchAndSeedPlayers.ts
 *
 * Fetches real player data from v3.football.api-sports.io and seeds the Player collection.
 *
 * Free plan limits: 100 requests/day, 10 requests/minute.
 * This script saves progress to .seed-progress.json so it can be safely re-run
 * across multiple days when using the free plan (~180 total requests for 7 leagues).
 *
 * Usage:
 *   npm run fetch-players
 *   npm run fetch-players -- --reset   (clears progress and starts fresh)
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/config/db.config';
import { Player } from '@/models/player.model';
import { ApiFootballPlayer, Position, PositionGroup } from '@/types/game.types';
import seedData from '@/data/clubs.seed.json';
import affinityOverrides from '@/data/affinity-overrides.json';

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const SEASON = 2025;
const PROGRESS_FILE = path.join(__dirname, '../data/.seed-progress.json');

// Rate limit: max 10 req/min (free plan). We use 6s between requests to be safe.
const DELAY_BETWEEN_REQUESTS_MS = 6500;
// Per-run request budget. Stay under 90/day to leave headroom.
const MAX_REQUESTS_PER_RUN = 90;

interface SeedProgress {
  completedLeagues: number[];
  completedPages: Record<number, number>; // leagueId -> last completed page
  totalInserted: number;
  lastRun: string;
}

function loadProgress(): SeedProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completedLeagues: [], completedPages: {}, totalInserted: 0, lastRun: '' };
}

function saveProgress(progress: SeedProgress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet(path: string): Promise<any> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY is not set in .env');

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} — ${url}`);
  }

  const data = await response.json();

  // Check for API-level errors
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API error: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

// ─── Stat derivation helpers ────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

/** Maps api-sports.io position string to our internal Position type */
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
  // FWD
  if (pos.includes('left')) return 'LW';
  if (pos.includes('right')) return 'RW';
  return 'ST';
}

function mapPositionGroup(positionStr: string): PositionGroup {
  const p = positionStr.toLowerCase();
  if (p.includes('goalkeeper')) return 'GK';
  if (p.includes('defender')) return 'DEF';
  if (p.includes('midfielder')) return 'MID';
  return 'FWD';
}

/** Generate short name from full name (e.g., "Jude Victor William Bellingham" -> "J. Bellingham") */
function generateShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fullName.slice(0, 10);
  if (parts.length === 1) return parts[0].slice(0, 10);
  // First initial + last name: "J. Bellingham"
  const firstInitial = parts[0].charAt(0);
  const lastName = parts[parts.length - 1];
  return `${firstInitial}. ${lastName}`.slice(0, 15);
}

/** Derive game stats from real match statistics */
function deriveStats(
  apiPlayer: ApiFootballPlayer,
  positionGroup: PositionGroup
): {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
} {
  const stats = apiPlayer.statistics[0];
  const apps = Math.max(stats.games.appearences || 1, 1);
  const rating = parseFloat(stats.games.rating || '6.5');

  const overall = clamp(rating * 10, 50, 95);

  // Pace: position-based default + slight variation
  const paceDefaults: Record<PositionGroup, number> = { GK: 38, DEF: 60, MID: 68, FWD: 75 };
  const pace = clamp(paceDefaults[positionGroup] + (Math.floor(Math.random() * 14) - 7), 30, 90);

  // Shooting: goals per game + shots on target rate
  const goals = stats.goals.total ?? 0;
  const shotsTotal = stats.shots?.total ?? 1;
  const shotsOn = stats.shots?.on ?? 0;
  const goalsPerGame = goals / apps;
  const shotAccuracy = shotsTotal > 0 ? shotsOn / shotsTotal : 0;
  const shooting = positionGroup === 'GK'
    ? 30
    : clamp(goalsPerGame * 250 + shotAccuracy * 40 + 40, 35, 95);

  // Passing: pass accuracy % + key passes per game
  const passAcc = stats.passes?.accuracy ?? 70;
  const keyPasses = stats.passes?.key ?? 0;
  const keyPassesPerGame = keyPasses / apps;
  const passing = clamp(passAcc * 0.65 + keyPassesPerGame * 40 + 15, 40, 95);

  // Dribbling: dribble success rate
  const dribAttempts = stats.dribbles?.attempts ?? 0;
  const dribSuccess = stats.dribbles?.success ?? 0;
  const dribRate = dribAttempts > 0 ? dribSuccess / dribAttempts : 0.5;
  const dribbling = positionGroup === 'GK'
    ? 35
    : clamp(dribRate * 60 + dribAttempts / apps * 8 + 35, 35, 95);

  // Defending: tackles + interceptions + blocks per game
  const tackles = stats.tackles?.total ?? 0;
  const interceptions = stats.tackles?.interceptions ?? 0;
  const blocks = stats.tackles?.blocks ?? 0;
  const defActions = (tackles + interceptions + blocks) / apps;
  const defending = positionGroup === 'GK'
    ? clamp(passing - 5, 35, 75)
    : clamp(defActions * 12 + 35, 30, 95);

  // Physical: duels won rate
  const duelsTotal = stats.duels?.total ?? 1;
  const duelsWon = stats.duels?.won ?? 0;
  const duelsWonRate = duelsTotal > 0 ? duelsWon / duelsTotal : 0.5;
  const physical = clamp(duelsWonRate * 60 + duelsTotal / apps * 3 + 35, 35, 90);

  return { overall, pace, shooting, passing, dribbling, defending, physical };
}

/** Estimate market value in millions GBP from overall rating, age, and position */
function estimateMarketValue(overall: number, age: number, positionGroup: PositionGroup): number {
  if (overall < 55) return 1;

  // Age multiplier: peaks at 24-26, declines after
  let ageFactor: number;
  if (age <= 21) ageFactor = 0.7;
  else if (age <= 23) ageFactor = 0.9;
  else if (age <= 26) ageFactor = 1.0;
  else if (age <= 29) ageFactor = 0.75;
  else if (age <= 31) ageFactor = 0.45;
  else ageFactor = 0.2;

  // Position factor
  const positionFactor: Record<PositionGroup, number> = { FWD: 1.2, MID: 1.0, DEF: 0.85, GK: 0.7 };

  const base = Math.pow(overall - 55, 1.8) * 0.15;
  const value = base * ageFactor * positionFactor[positionGroup];

  return Math.max(0.5, Math.round(value * 10) / 10); // round to 1dp
}

// ─── Main fetch logic ────────────────────────────────────────────────────────

async function fetchPlayersForLeague(
  leagueApiId: number,
  leagueName: string,
  progress: SeedProgress,
  requestsUsed: { count: number }
): Promise<void> {
  console.log(`\n📋 Fetching players for ${leagueName} (league ${leagueApiId})...`);

  // Load affinity overrides into a map keyed by apiId
  const affinityMap = new Map<number, { affinityClubs: string[]; antiAffinityClubs: string[] }>();
  (affinityOverrides as any[]).forEach((o) => {
    affinityMap.set(o.playerApiId, {
      affinityClubs: o.affinityClubs,
      antiAffinityClubs: o.antiAffinityClubs,
    });
  });

  let page = (progress.completedPages[leagueApiId] ?? 0) + 1;

  // First fetch: get total pages
  await sleep(DELAY_BETWEEN_REQUESTS_MS);
  if (requestsUsed.count >= MAX_REQUESTS_PER_RUN) {
    console.log(`⚠️  Request budget exhausted. Save progress and re-run tomorrow.`);
    return;
  }

  const firstPageData = await apiGet(`/players?league=${leagueApiId}&season=${SEASON}&page=${page}`);
  requestsUsed.count++;

  const totalPages: number = firstPageData.paging?.total ?? 1;
  console.log(`   Pages: ${page} → ${totalPages}`);

  const pagesToProcess = [firstPageData, ...Array(Math.max(0, totalPages - page)).fill(null)];

  for (let i = 0; i < pagesToProcess.length; i++) {
    if (requestsUsed.count >= MAX_REQUESTS_PER_RUN && i > 0) {
      console.log(`⚠️  Hit request budget (${MAX_REQUESTS_PER_RUN}). Progress saved. Re-run tomorrow.`);
      saveProgress(progress);
      return;
    }

    let pageData: any;
    const currentPage = page + i;

    if (i === 0) {
      pageData = pagesToProcess[0]; // already fetched
    } else {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
      console.log(`   Fetching page ${currentPage}/${totalPages}...`);
      pageData = await apiGet(`/players?league=${leagueApiId}&season=${SEASON}&page=${currentPage}`);
      requestsUsed.count++;
    }

    const players: ApiFootballPlayer[] = pageData.response ?? [];

    const bulkOps = players
      .filter((p) => p.statistics && p.statistics.length > 0)
      .map((p) => {
        const stat = p.statistics[0];
        const posGroup = mapPositionGroup(stat.games.position ?? '');
        const pos = mapPosition(stat.games.position ?? '', posGroup);
        const derivedStats = deriveStats(p, posGroup);
        const marketValue = estimateMarketValue(derivedStats.overall, p.player.age, posGroup);
        const overrides = affinityMap.get(p.player.id);

        return {
          updateOne: {
            filter: { apiId: p.player.id },
            update: {
              $set: {
                apiId: p.player.id,
                name: p.player.name,
                shortName: generateShortName(p.player.name),
                nationality: p.player.nationality ?? '',
                club: stat.team.name,
                clubApiId: stat.team.id,
                league: leagueName,
                position: pos,
                positionGroup: posGroup,
                age: p.player.age,
                marketValue,
                stats: derivedStats,
                photoUrl: p.player.photo ?? '',
                affinityClubs: overrides?.affinityClubs ?? [],
                antiAffinityClubs: overrides?.antiAffinityClubs ?? [],
                isFreeAgent: false,
              },
            },
            upsert: true,
          },
        };
      });

    if (bulkOps.length > 0) {
      await Player.bulkWrite(bulkOps as any);
      progress.totalInserted += bulkOps.length;
      console.log(`   ✅ Page ${currentPage}: upserted ${bulkOps.length} players`);
    }

    // Save progress after each page
    progress.completedPages[leagueApiId] = currentPage;
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);
  }

  // Mark league as complete
  if (!progress.completedLeagues.includes(leagueApiId)) {
    progress.completedLeagues.push(leagueApiId);
  }
  saveProgress(progress);
  console.log(`✅ ${leagueName} complete`);
}

async function main() {
  const shouldReset = process.argv.includes('--reset');

  if (shouldReset && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log('🔄 Progress reset');
  }

  if (!API_KEY) {
    console.error('❌ API_FOOTBALL_KEY is not set in your .env file');
    process.exit(1);
  }

  console.log('🌍 Starting player fetch from v3.football.api-sports.io');
  console.log(`   Season: ${SEASON} | Max requests this run: ${MAX_REQUESTS_PER_RUN}`);

  await connectToDatabase();

  const progress = loadProgress();
  const requestsUsed = { count: 0 };

  const leagues = seedData.leagues;

  for (const league of leagues) {
    if (progress.completedLeagues.includes(league.apiId)) {
      console.log(`⏭️  Skipping ${league.name} (already complete)`);
      continue;
    }
    if (requestsUsed.count >= MAX_REQUESTS_PER_RUN) {
      console.log(`⚠️  Request budget exhausted. Re-run tomorrow to continue.`);
      break;
    }
    await fetchPlayersForLeague(league.apiId, league.name, progress, requestsUsed);
  }

  const totalPlayers = await Player.countDocuments();
  console.log(`\n📊 Summary:`);
  console.log(`   Requests used this run: ${requestsUsed.count}`);
  console.log(`   Total players in DB: ${totalPlayers}`);
  console.log(`   Leagues completed: ${progress.completedLeagues.length}/${leagues.length}`);

  if (progress.completedLeagues.length < leagues.length) {
    console.log(`\n⚠️  Not all leagues have been fetched yet.`);
    console.log(`   Re-run "npm run fetch-players" tomorrow to continue.`);
    console.log(`   Progress is saved in src/data/.seed-progress.json`);
  } else {
    console.log(`\n🎉 All leagues fetched! Player seed is complete.`);
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  }

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error('❌ Fetch failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
