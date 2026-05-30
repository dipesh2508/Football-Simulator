/**
 * parseFC26ToJson.ts
 *
 * Parses FC26_20250921.csv and writes players from our 56 clubs to players.seed.json.
 * This replaces the api-football fetch pipeline entirely — no API key or rate limits needed.
 *
 * - Uses FC26 player_id as apiId (replaces api-sports IDs)
 * - Uses FC26 club_team_id as clubApiId
 * - marketValue: value_eur × 0.85 ÷ 1,000,000  (EUR → GBP millions, 1 decimal place)
 * - wage:        wage_eur × 0.85, rounded        (EUR/week → GBP/week integer)
 * - Affinity rules matched by player long_name substring (from affinity-overrides.json)
 * - Promoted clubs (Coventry, Hull City, Ipswich) are matched automatically via club_name
 *
 * Usage:
 *   npm run parse-fc26
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import seedData from '@/data/clubs.seed.json';
import affinityOverrides from '@/data/affinity-overrides.json';
import type { Position, PositionGroup, League } from '@/types/game.types';
import type { PlayerSeedEntry } from './fetchToJson';

const CSV_FILE = path.join(__dirname, '../data/FC26_20250921.csv');
const OUTPUT_FILE = path.join(__dirname, '../data/players.seed.json');
const MIN_OVERALL = 65;

// ─── Club name normalisation ──────────────────────────────────────────────────
// FC26 uses different names for some clubs vs what's in clubs.seed.json

const FC26_CLUB_NAME_MAP: Record<string, string> = {
  // Premier League
  'Fulham FC': 'Fulham',
  'AFC Bournemouth': 'Bournemouth',
  // La Liga
  'FC Barcelona': 'Barcelona',
  'Atlético Madrid': 'Atletico Madrid',
  'Sevilla FC': 'Sevilla',
  'Real Betis Balompié': 'Real Betis',
  'Villarreal CF': 'Villarreal',
  'Valencia CF': 'Valencia',
  'RC Celta': 'Celta Vigo',
  'RCD Espanyol': 'Espanyol',
  'Getafe CF': 'Getafe',
  'CA Osasuna': 'Osasuna',
  'RCD Mallorca': 'Mallorca',
  'Deportivo Alavés': 'Deportivo Alaves',
  'Elche CF': 'Elche',
  'Levante UD': 'Levante',
  'Granada CF': 'Granada',       // La Liga 2 in FC26
  'Cádiz CF': 'Cadiz',           // La Liga 2 in FC26
  // Bundesliga
  'FC Bayern München': 'Bayern Munich',
  'Bayer 04 Leverkusen': 'Bayer Leverkusen',
  'Borussia Mönchengladbach': 'Borussia Monchengladbach',
  'SV Werder Bremen': 'Werder Bremen',
  'TSG 1899 Hoffenheim': 'TSG Hoffenheim',
  '1. FSV Mainz 05': 'Mainz 05',
  'Hertha BSC': 'Hertha Berlin',
  'Fortuna Düsseldorf': 'Fortuna Dusseldorf',  // 2. Bundesliga in FC26
  '1. FC Nürnberg': '1. FC Nurnberg',           // 2. Bundesliga in FC26
  'SpVgg Greuther Fürth': 'Greuther Furth',     // 2. Bundesliga in FC26
  // Serie A
  'Inter': 'Inter Milan',
  'Roma': 'AS Roma',
  'Hellas Verona FC': 'Hellas Verona',
  // Ligue 1
  'Olympique de Marseille': 'Olympique Marseille',
  'Stade Rennais FC': 'Stade Rennais',
  'Lille OSC': 'LOSC Lille',
  'RC Strasbourg Alsace': 'RC Strasbourg',
  'Angers SCO': 'Angers',
  'FC Lorient': 'Lorient',
  'Stade Brestois 29': 'Stade Brestois',
  'Montpellier HSC': 'Montpellier',
  'AS Saint-Étienne': 'Saint-Etienne',  // Ligue 2 in FC26
  'Clermont Foot 63': 'Clermont Foot',  // Ligue 2 in FC26
  'ESTAC Troyes': 'Troyes',             // Ligue 2 in FC26
  // Eredivisie
  'PSV': 'PSV Eindhoven',
  // Primeira Liga
  'SL Benfica': 'Benfica',
  'FC Porto': 'Porto',
  'Sporting Clube de Braga': 'SC Braga',
};

function normalizeClubName(name: string): string {
  return FC26_CLUB_NAME_MAP[name] ?? name;
}

// ─── Position mapping ─────────────────────────────────────────────────────────
// FC26 positions (first token) → our Position type

const POSITION_MAP: Record<string, Position> = {
  GK: 'GK',
  CB: 'CB', LCB: 'CB', RCB: 'CB',
  LB: 'LB', LWB: 'LB',
  RB: 'RB', RWB: 'RB',
  CDM: 'CDM', LDM: 'CDM', RDM: 'CDM',
  CM: 'CM', LCM: 'CM', RCM: 'CM',
  CAM: 'CAM', LAM: 'CAM', RAM: 'CAM',
  LM: 'LW', LW: 'LW',
  RM: 'RW', RW: 'RW',
  ST: 'ST', LS: 'ST', RS: 'ST', LF: 'ST', RF: 'ST',
  CF: 'CF',
};

function mapPosition(rawPositions: string): Position {
  const first = rawPositions.split(',')[0].trim().toUpperCase();
  return POSITION_MAP[first] ?? 'CM'; // fallback: treat unknowns as CM
}

/**
 * Returns all unique alt positions from the CSV player_positions field,
 * excluding the primary position.
 */
function mapAltPositions(rawPositions: string, primary: Position): Position[] {
  const tokens = rawPositions.split(',').map((t) => t.trim().toUpperCase());
  const seen = new Set<Position>([primary]);
  const alts: Position[] = [];
  for (const token of tokens) {
    const pos = POSITION_MAP[token];
    if (pos && !seen.has(pos)) {
      seen.add(pos);
      alts.push(pos);
    }
  }
  return alts;
}

function toPositionGroup(pos: Position): PositionGroup {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM') return 'MID';
  return 'FWD'; // LW, RW, ST, CF
}

// ─── Lookup structures ────────────────────────────────────────────────────────

// normalised club name → League (from clubs.seed.json — authoritative source)
const clubToLeague = new Map<string, League>();
const allowedClubs = new Set<string>();

for (const club of seedData.clubs) {
  allowedClubs.add(club.name);
  clubToLeague.set(club.name, club.league as League);
}

// Affinity: list of { nameWords, affinityClubs, antiAffinityClubs }
// Matched via all-words substring check against FC26 long_name
const affinityList = (affinityOverrides as Array<{
  name: string;
  affinityClubs: string[];
  antiAffinityClubs: string[];
}>).map((o) => ({
  nameWords: o.name.toLowerCase().split(' ').filter(Boolean),
  affinityClubs: o.affinityClubs,
  antiAffinityClubs: o.antiAffinityClubs,
}));

function getAffinity(longName: string): { affinityClubs: string[]; antiAffinityClubs: string[] } {
  const lower = longName.toLowerCase();
  for (const entry of affinityList) {
    if (entry.nameWords.every((w) => lower.includes(w))) {
      return {
        affinityClubs: entry.affinityClubs,
        antiAffinityClubs: entry.antiAffinityClubs,
      };
    }
  }
  return { affinityClubs: [], antiAffinityClubs: [] };
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped double-quotes ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function safeNum(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// Synthetic contract expiry: FC26 doesn't have contract data so we derive a
// deterministic-but-varied expiry year from age + overall.
// Young players tend to have longer deals; veterans shorter ones.
function generateContractExpiry(age: number, overall: number): number {
  const seed = (age * 7 + overall * 3) % 100;
  let years: number;
  if (age <= 22) {
    years = 2 + (seed % 3); // 2–4 years remaining
  } else if (age >= 32) {
    years = 1 + (seed % 2); // 1–2 years remaining
  } else {
    years = 1 + (seed % 4); // 1–4 years remaining
  }
  return 2026 + years;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚽ FC26 → players.seed.json');
  console.log(`📂 Input : ${CSV_FILE}`);
  console.log(`📄 Output: ${OUTPUT_FILE}`);
  console.log(`⚙️  Min overall : ${MIN_OVERALL}`);
  console.log(`🏟️  Clubs tracked: ${allowedClubs.size}\n`);

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV not found: ${CSV_FILE}`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_FILE, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let isFirstLine = true;
  const players: PlayerSeedEntry[] = [];
  const clubCounts = new Map<string, number>();
  let rowCount = 0;
  let skippedClub = 0;
  let skippedOverall = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (isFirstLine) {
      headers = parseCSVLine(line);
      isFirstLine = false;
      continue;
    }

    rowCount++;
    const cols = parseCSVLine(line);

    // Build row object
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });

    // ── Club filter ────────────────────────────────────────────────────────────
    const normalizedClub = normalizeClubName(row.club_name ?? '');
    if (!allowedClubs.has(normalizedClub)) {
      skippedClub++;
      continue;
    }

    // ── Overall filter ─────────────────────────────────────────────────────────
    const overall = safeNum(row.overall);
    if (overall < MIN_OVERALL) {
      skippedOverall++;
      continue;
    }

    // ── Field mapping ──────────────────────────────────────────────────────────
    const longName = row.long_name ?? row.short_name ?? 'Unknown';
    const position = mapPosition(row.player_positions ?? 'CM');
    const altPositions = mapAltPositions(row.player_positions ?? '', position);
    const positionGroup = toPositionGroup(position);
    const league = clubToLeague.get(normalizedClub)!;
    const { affinityClubs, antiAffinityClubs } = getAffinity(longName);

    const valueEur = safeNum(row.value_eur);
    const wageEur = safeNum(row.wage_eur);
    const marketValue = Math.round((valueEur * 0.85) / 1_000_000 * 10) / 10;
    const wage = Math.round(wageEur * 0.85);
    const age = safeNum(row.age);
    const contractExpiry = generateContractExpiry(age, overall);

    const entry: PlayerSeedEntry = {
      apiId: parseInt(row.player_id) || 0,
      name: longName,
      shortName: row.short_name ?? 'Unknown',
      nationality: row.nationality_name ?? '',
      club: normalizedClub,
      clubApiId: parseInt(row.club_team_id) || 0,
      league,
      position,
      positionGroup,
      altPositions,
      age,
      marketValue: Math.max(marketValue, 0.1),
      wage,
      contractExpiry,
      photoUrl: row.player_face_url ?? '',
      affinityClubs,
      antiAffinityClubs,
      isFreeAgent: false,
      stats: {
        overall,
        pace: safeNum(row.pace),
        shooting: safeNum(row.shooting),
        passing: safeNum(row.passing),
        dribbling: safeNum(row.dribbling),
        defending: safeNum(row.defending),
        physical: safeNum(row.physic),
      },
    };

    players.push(entry);
    clubCounts.set(normalizedClub, (clubCounts.get(normalizedClub) ?? 0) + 1);
  }

  // ── Write output ─────────────────────────────────────────────────────────────
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(players, null, 2), 'utf-8');

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('📊 Parse Summary');
  console.log(`   Total CSV rows processed : ${rowCount}`);
  console.log(`   Skipped (not our clubs)  : ${skippedClub}`);
  console.log(`   Skipped (overall < ${MIN_OVERALL})  : ${skippedOverall}`);
  console.log(`   Players written          : ${players.length}`);

  console.log('\n🏟️  Players per club:');
  const sorted = [...clubCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [clubName, count] of sorted) {
    const warn = count < 15 ? ' ⚠️  (low — check name mapping)' : '';
    console.log(`   ${clubName.padEnd(35)} ${String(count).padStart(3)}${warn}`);
  }

  const missing = [...allowedClubs].filter((c) => !clubCounts.has(c));
  if (missing.length > 0) {
    console.log('\n⚠️  Clubs with 0 players (likely name mismatch — add to FC26_CLUB_NAME_MAP):');
    missing.forEach((c) => console.log(`   - "${c}"`));
  }

  console.log(`\n✅ Written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('❌ Parse failed:', err.message);
  process.exit(1);
});
