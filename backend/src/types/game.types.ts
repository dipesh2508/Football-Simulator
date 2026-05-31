export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST'
  | 'CF';

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export type League =
  | 'Premier League'
  | 'EFL Championship'
  | 'La Liga'
  | 'La Liga 2'
  | 'Bundesliga'
  | '2. Bundesliga'
  | 'Serie A'
  | 'Serie B'
  | 'Ligue 1'
  | 'Ligue 2'
  | 'Eredivisie'
  | 'Primeira Liga'
  | 'Saudi Pro League'
  | 'MLS'
  | 'Super Lig'
  | 'Ekstraklasa'
  | 'Jupiler Pro League'
  | 'Austrian Bundesliga';

export type GamePhase =
  | 'team_selection'
  | 'summer_transfer'
  | 'season'
  | 'january_transfer'
  | 'season_end';

export type TransferWindow = 'summer' | 'january';

export type LikelihoodLabel = 'certain' | 'high' | 'medium' | 'low' | 'impossible';

export interface PlayerStats {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface StandingEntry {
  team: string;
  teamApiId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface GoalEvent {
  scorerName: string;
  scorerApiId: number;
  assisterName?: string;
  assisterApiId?: number;
  team: string;
  isPenalty?: boolean;
  minute: number;
}

export interface CardEvent {
  playerName: string;
  playerApiId: number;
  team: string;
  type: 'yellow' | 'red';
}

export interface SubstitutionEvent {
  playerOffName: string;
  playerOffApiId: number;
  playerOnName: string;
  playerOnApiId: number;
  team: string;
  minute: number;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  goals: GoalEvent[];
  cards: CardEvent[];
  substitutions: SubstitutionEvent[];
}

export interface Fixture {
  gameweek: number;
  homeTeam: string;
  awayTeam: string;
  result?: MatchResult;
}

export interface PlayerSeasonStats {
  playerId: string;
  playerApiId: number;
  playerName: string;
  club: string;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
}

export interface TransferRecord {
  playerId: string;
  playerName: string;
  fee: number;
  window: TransferWindow;
  type: 'buy' | 'sell';
  timestamp: Date;
}

export interface LikelihoodResult {
  score: number;
  label: LikelihoodLabel;
}

// ── Lineup / Formation types ──────────────────────────────────────────────────

export type FormationName =
  | '4-4-2'
  | '4-3-3'
  | '4-2-3-1'
  | '3-5-2'
  | '5-3-2'
  | '4-5-1'
  | '4-3-2-1'
  | '4-4-1-1'
  | '3-4-3'
  | '4-1-4-1'
  | '4-3-3 hold'
  | '4-2-3-1 wide';

export interface FormationSlotDef {
  slotId: string;   // e.g. "gk", "cb1", "lst"
  label: string;    // e.g. "GK", "CB", "ST"
  positionGroup: PositionGroup;
}

export interface LineupSlot {
  slotId: string;
  label: string;
  positionGroup: PositionGroup;
  playerId?: string; // ObjectId as string
  isAltPosition?: boolean;
}

/** Team strength breakdown for display purposes */
export interface TeamStrengthScore {
  attack: number;
  midfield: number;
  defence: number;
  overall: number;
}

/** Pitch coordinate (percentage from top-left) for visual layout */
export interface SlotCoord {
  x: number; // 0–100, horizontal
  y: number; // 0–100, vertical (0 = top / attacking end)
}

export const FORMATIONS: Record<FormationName, FormationSlotDef[]> = {
  '4-4-2': [
    { slotId: 'gk',  label: 'GK', positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB', positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB', positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB', positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB', positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM', positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM', positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM', positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM', positionGroup: 'MID' },
    { slotId: 'lst', label: 'ST', positionGroup: 'FWD' },
    { slotId: 'rst', label: 'ST', positionGroup: 'FWD' },
  ],
  '4-3-3': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cam', label: 'CAM', positionGroup: 'MID' },
    { slotId: 'lw',  label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',  label: 'RW',  positionGroup: 'FWD' },
  ],
  '4-2-3-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm1',label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cdm2',label: 'CDM', positionGroup: 'MID' },
    { slotId: 'lam', label: 'LAM', positionGroup: 'MID' },
    { slotId: 'cam', label: 'CAM', positionGroup: 'MID' },
    { slotId: 'ram', label: 'RAM', positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  '3-5-2': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb3', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'lwb', label: 'LWB', positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm3', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rwb', label: 'RWB', positionGroup: 'MID' },
    { slotId: 'lst', label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rst', label: 'ST',  positionGroup: 'FWD' },
  ],
  '5-3-2': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lwb', label: 'LWB', positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb3', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rwb', label: 'RWB', positionGroup: 'DEF' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm3', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'lst', label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rst', label: 'ST',  positionGroup: 'FWD' },
  ],
  '4-5-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cdm', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  // Christmas Tree: 4 DEF · 3 CM · 2 CAM · 1 ST
  '4-3-2-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm3', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'lam', label: 'LAM', positionGroup: 'MID' },
    { slotId: 'ram', label: 'RAM', positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  // Second striker/shadow striker behind lone ST
  '4-4-1-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'ss',  label: 'SS',  positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  // Three at the back with attacking wide midfielders
  '3-4-3': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb3', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'lw',  label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',  label: 'RW',  positionGroup: 'FWD' },
  ],
  // Single pivot CDM with four attack-minded mids
  '4-1-4-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  // Holding 4-3-3: CDM + 2 CMs shields the defence while LW/ST/RW attack
  '4-3-3 hold': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'lw',  label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',  label: 'RW',  positionGroup: 'FWD' },
  ],
  // Wide 4-2-3-1: true wingers (FWD group) flank a central CAM behind the ST
  '4-2-3-1 wide': [
    { slotId: 'gk',   label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',   label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1',  label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2',  label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',   label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm1', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cdm2', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cam',  label: 'CAM', positionGroup: 'MID' },
    { slotId: 'lw',   label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',   label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',   label: 'RW',  positionGroup: 'FWD' },
  ],
};

// API response type from v3.football.api-sports.io /players endpoint
export interface ApiFootballPlayer {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: { date: string; place: string; country: string };
    nationality: string;
    height: string;
    weight: string;
    photo: string;
  };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    league: { id: number; name: string; season: number };
    games: {
      appearences: number;
      lineups: number;
      minutes: number;
      position: string;
      rating: string | null;
    };
    goals: { total: number | null; assists: number | null };
    shots: { total: number | null; on: number | null };
    passes: { total: number | null; key: number | null; accuracy: number | null };
    tackles: { total: number | null; blocks: number | null; interceptions: number | null };
    duels: { total: number | null; won: number | null };
    dribbles: { attempts: number | null; success: number | null };
    fouls: { drawn: number | null; committed: number | null };
    cards: { yellow: number; yellowred: number; red: number };
  }>;
}
