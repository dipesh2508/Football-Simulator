const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

// ── Clubs ───────────────────────────────────────────────────────────────────

// ── Sessions ────────────────────────────────────────────────────────────────

export const api = {
  getClubs: () =>
    request<{ clubs: SeedClub[] }>('/clubs'),

  createSession: () =>
    request<{ sessionId: string }>('/sessions', { method: 'POST' }),

  getSession: (sessionId: string) =>
    request<SessionData>(`/sessions/${sessionId}`),

  selectTeam: (sessionId: string, teamName: string) =>
    request<SelectTeamResponse>(`/sessions/${sessionId}/team`, {
      method: 'POST',
      body: JSON.stringify({ teamName }),
    }),

  // ── Players ──────────────────────────────────────────────────────────────

  getTransferMarket: (sessionId: string, params: MarketParams = {}) => {
    const query = new URLSearchParams({ sessionId, ...buildQueryParams(params as Record<string, string | number | undefined>) }).toString();
    return request<MarketResponse>(`/players/market?${query}`);
  },

  getPlayer: (id: string) => request<Player>(`/players/${id}`),

  // ── Transfers ─────────────────────────────────────────────────────────────

  buyPlayer: (sessionId: string, playerId: string) =>
    request<TransferResponse>(`/sessions/${sessionId}/buy`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  sellPlayer: (sessionId: string, playerId: string) =>
    request<{ success: boolean; message: string; budget: number }>(
      `/sessions/${sessionId}/sell`,
      { method: 'POST', body: JSON.stringify({ playerId }) }
    ),

  confirmTransferWindow: (sessionId: string) =>
    request<ConfirmWindowResponse>(`/sessions/${sessionId}/transfers/confirm`, {
      method: 'POST',
    }),

  // ── Season ────────────────────────────────────────────────────────────────

  simulateGameweek: (sessionId: string) =>
    request<SimulateResponse>(`/sessions/${sessionId}/simulate`, { method: 'POST' }),

  simulateAll: (sessionId: string) =>
    request<SimulateAllResponse>(`/sessions/${sessionId}/simulate-all`, { method: 'POST' }),

  getStandings: (sessionId: string) =>
    request<StandingsResponse>(`/sessions/${sessionId}/standings`),

  getStats: (sessionId: string) =>
    request<StatsResponse>(`/sessions/${sessionId}/stats`),

  getTeamsSquads: (sessionId: string) =>
    request<TeamsSquadsResponse>(`/sessions/${sessionId}/teams`),

  // ── Lineup ────────────────────────────────────────────────────────────────────────────

  getLineup: (sessionId: string) =>
    request<LineupResponse>(`/sessions/${sessionId}/lineup`),

  saveLineup: (sessionId: string, formation: string, slots: LineupSlotSave[]) =>
    request<{ success: boolean; formation: string; slotsAssigned: number }>(
      `/sessions/${sessionId}/lineup`,
      { method: 'PUT', body: JSON.stringify({ formation, slots }) }
    ),
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlayerStats {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface Likelihood {
  score: number;
  label: 'certain' | 'high' | 'medium' | 'low' | 'impossible';
  reasons: string[];
}

export interface Player {
  _id: string;
  apiId: number;
  name: string;
  shortName: string;
  nationality: string;
  club: string;
  league: string;
  position: string;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  altPositions?: string[];
  age: number;
  marketValue: number;
  stats: PlayerStats;
  photoUrl?: string;
  isFreeAgent: boolean;
  likelihood?: Likelihood | null;
}

export interface StandingEntry {
  team: string;
  teamApiId?: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
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

export interface GoalEvent {
  scorerName: string;
  scorerApiId: number;
  assisterName?: string;
  assisterApiId?: number;
  team: string;
  minute: number;
  isPenalty?: boolean;
}

export interface SubstitutionEvent {
  playerOffName: string;
  playerOffApiId: number;
  playerOnName: string;
  playerOnApiId: number;
  team: string;
  minute: number;
}

export interface TeamStrengthScore {
  attack: number;
  midfield: number;
  defence: number;
  overall: number;
}

export interface TeamSquadInfo {
  clubName: string;
  clubApiId: number;
  logoUrl: string;
  isUserClub: boolean;
  promoted?: boolean;
  strengthScore: TeamStrengthScore;
  bestXI: {
    name: string;
    shortName: string;
    position: string;
    positionGroup: string;
    overall: number;
    photoUrl?: string;
  }[];
  squadSize: number;
}

export interface TeamsSquadsResponse {
  teams: TeamSquadInfo[];
  userTeam: string;
  phase: string;
}

export interface SessionData {
  sessionId: string;
  phase: string;
  userTeam?: string;
  userTeamApiId?: number;
  budget: number;
  squad: Player[];
  standings: StandingEntry[];
  playerSeasonStats: PlayerSeasonStats[];
  currentGameweek: number;
  transfers: TransferRecord[];
}

export interface TransferRecord {
  playerId: string;
  playerName: string;
  fee: number;
  window: 'summer' | 'january';
  type: 'buy' | 'sell';
  timestamp: string;
}

export interface SelectTeamResponse {
  userTeam: string;
  budget: number;
  squadCount: number;
  phase: string;
}

export interface MarketParams {
  page?: number;
  limit?: number;
  position?: string;
  league?: string;
  minValue?: number;
  maxValue?: number;
  search?: string;
}

export interface MarketResponse {
  players: Player[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface TransferResponse {
  success: boolean;
  message: string;
  budget?: number;
  likelihood?: Likelihood;
  player?: { name: string; position: string; overall: number };
}

export interface ConfirmWindowResponse {
  message: string;
  nextPhase: string;
  aiActivity: { club: string; signings: number; topSignings: string[] }[];
}

export interface SimulateResponse {
  gameweek: number;
  phase: string;
  matches: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    goals: GoalEvent[];
    substitutions: SubstitutionEvent[];
  }[];
  userStanding: number;
}

export interface SimulateAllResponse {
  simulatedUpTo: number;
  phase: string;
  message: string;
}

export interface StandingsResponse {
  standings: StandingEntry[];
  userTeam: string;
  currentGameweek: number;
  phase: string;
}

export interface StatsResponse {
  topScorers: PlayerSeasonStats[];
  topAssists: PlayerSeasonStats[];
  topCleanSheets: PlayerSeasonStats[];
  userTeam: string;
  currentGameweek: number;
}

export interface SeedClub {
  name: string;
  shortName: string;
  isPL: boolean;
  reputation: number;
  lastSeasonFinish?: number;
  budgetRange?: [number, number];
  promoted?: boolean;
}

// ── Lineup types ────────────────────────────────────────────────────────────────────────────

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

export interface LineupSlotData {
  slotId: string;
  label: string;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  player: Player | null;
  isAltPosition?: boolean;
}

export interface LineupResponse {
  formation: FormationName;
  startingXI: LineupSlotData[];
}

export interface LineupSlotSave {
  slotId: string;
  playerId: string | null;
}

export const FORMATION_NAMES: FormationName[] = [
  '4-4-2', '4-3-3', '4-3-3 hold', '4-2-3-1', '4-2-3-1 wide',
  '3-5-2', '5-3-2', '4-5-1', '4-3-2-1', '4-4-1-1', '3-4-3', '4-1-4-1',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildQueryParams(params: Record<string, string | number | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') result[k] = String(v);
  }
  return result;
}
