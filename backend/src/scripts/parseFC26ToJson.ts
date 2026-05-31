/**
 * parseFC26ToJson.ts
 *
 * Parses FC26_20250921.csv and writes players from major leagues to players.seed.json.
 * Major leagues include: Top 5 divisions + their second tiers + Saudi Arabia + MLS + others.
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
  // Serie A & B
  'Inter': 'Inter Milan',
  'Roma': 'AS Roma',
  'Hellas Verona FC': 'Hellas Verona',
  'US Lecce': 'Lecce',
  'Empoli FC': 'Empoli',
  'US Salernitana': 'Salernitana',
  // Ligue 1 & 2
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
  
  // Saudi Pro League
  'Al-Hilal': 'Al Hilal',
  'Al Hilal SFC': 'Al Hilal',
  'Al-Nassr': 'Al Nassr',
  'Al Nassr FC': 'Al Nassr',
  'Al-Ittihad': 'Al Ittihad',
  'Al Ittihad Club': 'Al Ittihad',
  'Al-Shabab': 'Al Shabab',
  'Al Shabab FC': 'Al Shabab',
  'Al-Fayha': 'Al Fayha',
  'Al Fayha Club': 'Al Fayha',
  'Al Taawoun': 'Al Taawoun',
  'Al Taawoun FC': 'Al Taawoun',
  'Al-Qadsiah': 'Al Qadsiah',
  'Al Qadsiah FC': 'Al Qadsiah',
  'Al Raed': 'Al Raed',
  'Al Raed Club': 'Al Raed',
  
  // MLS
  'LA Galaxy': 'LA Galaxy',
  'New York City FC': 'NYCFC',
  'LAFC': 'Los Angeles FC',
  'Inter Miami CF': 'Inter Miami',
  'FC Dallas': 'Dallas',
  'Seattle Sounders': 'Seattle Sounders',
  'New York Red Bulls': 'New York RB',
  'Manchester City': 'Manchester City',  // MCFC in MLS context
};

// Extended league mappings for clubs not in seed data
const FC26_CLUB_LEAGUE_MAP: Record<string, League> = {
  // La Liga 2
  'Granada': 'La Liga 2',
  'Cadiz': 'La Liga 2',
  'Levante': 'La Liga 2',
  // 2. Bundesliga
  'Fortuna Dusseldorf': '2. Bundesliga',
  '1. FC Nurnberg': '2. Bundesliga',
  'Greuther Furth': '2. Bundesliga',
  'Schalke': '2. Bundesliga',
  // Serie B
  'Lecce': 'Serie B',
  'Empoli': 'Serie B',
  'Salernitana': 'Serie B',
  'Reggina': 'Serie B',
  // Ligue 2
  'Saint-Etienne': 'Ligue 2',
  'Clermont Foot': 'Ligue 2',
  'Troyes': 'Ligue 2',
  'Metz': 'Ligue 2',
  // Saudi Pro League
  'Al Hilal': 'Saudi Pro League',
  'Al Nassr': 'Saudi Pro League',
  'Al Ittihad': 'Saudi Pro League',
  'Al Shabab': 'Saudi Pro League',
  'Al Fayha': 'Saudi Pro League',
  'Al Taawoun': 'Saudi Pro League',
  'Al Qadsiah': 'Saudi Pro League',
  'Al Raed': 'Saudi Pro League',
  // MLS
  'LA Galaxy': 'MLS',
  'NYCFC': 'MLS',
  'Los Angeles FC': 'MLS',
  'Inter Miami': 'MLS',
  'Dallas': 'MLS',
  'Seattle Sounders': 'MLS',
  'New York RB': 'MLS',
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

for (const club of seedData.clubs) {
  clubToLeague.set(club.name, club.league as League);
}

// Major leagues to include: top 5 divisions + second divisions + Saudi Arabia + MLS
const MAJOR_LEAGUES = new Set<string>([
  'Premier League',
  'EFL Championship',
  'La Liga',
  'La Liga 2',
  'Bundesliga',
  '2. Bundesliga',
  'Serie A',
  'Serie B',
  'Ligue 1',
  'Ligue 2',
  'Eredivisie',
  'Primeira Liga',
  'Saudi Pro League',
  'MLS',
  'Super Lig',         // Turkey
  'Super Lig Pro',     // Turkey alternate
  'Süper Lig',         // Turkey (accented)
  'Ekstraklasa',       // Poland
  'Jupiler Pro League', // Belgium
  'Austrian Bundesliga',
]);

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
  console.log(`⚙️  Min overall : ${MIN_OVERALL}\n`);

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
  const leagueCounts = new Map<string, number>();
  let rowCount = 0;
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

    // ── Club & Overall filter ─────────────────────────────────────────────────
    const overall = safeNum(row.overall);
    if (overall < MIN_OVERALL) {
      skippedOverall++;
      continue;
    }

    // ── Field mapping ──────────────────────────────────────────────────────────
    const normalizedClub = normalizeClubName(row.club_name ?? '');
    
    // Determine league: first check seed data, then FC26 mapping, then skip
    let league: League | undefined = clubToLeague.get(normalizedClub);
    if (!league) {
      league = FC26_CLUB_LEAGUE_MAP[normalizedClub] as League | undefined;
    }
    if (!league) {
      // League not recognized; skip this player
      skippedOverall++;
      continue;
    }
    
    // Check if league is in major leagues whitelist
    if (!MAJOR_LEAGUES.has(league)) {
      skippedOverall++;
      continue;
    }

    const longName = row.long_name ?? row.short_name ?? 'Unknown';
    const position = mapPosition(row.player_positions ?? 'CM');
    const altPositions = mapAltPositions(row.player_positions ?? '', position);
    const positionGroup = toPositionGroup(position);
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
    leagueCounts.set(league, (leagueCounts.get(league) ?? 0) + 1);
  }

  // ── Write output ─────────────────────────────────────────────────────────────
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(players, null, 2), 'utf-8');

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('📊 Parse Summary');
  console.log(`   Total CSV rows processed : ${rowCount}`);
  console.log(`   Skipped (overall < ${MIN_OVERALL}) : ${skippedOverall}`);
  console.log(`   Players written          : ${players.length}`);

  console.log('\n⚽ Players per league:');
  const sortedLeagues = [...leagueCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [leagueName, count] of sortedLeagues) {
    console.log(`   ${leagueName.padEnd(35)} ${String(count).padStart(4)}`);
  }

  console.log('\n🏟️  Players per club:');
  const sortedClubs = [...clubCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [clubName, count] of sortedClubs) {
    console.log(`   ${clubName.padEnd(35)} ${String(count).padStart(3)}`);
  }

  console.log(`\n✅ Written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('❌ Parse failed:', err.message);
  process.exit(1);
});
