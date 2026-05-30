import { IPlayer } from '@/models/player.model';
import { MatchResult, GoalEvent, CardEvent } from '@/types/game.types';

const HOME_ADVANTAGE = 1.15; // 15% attack boost for home team

/** Realistic expected goals baseline per team per match (PL average ≈ 1.2) */
const BASE_EXPECTED_GOALS = 1.2;

/**
 * Subtract this baseline before computing the attack/defense ratio so quality
 * differences are amplified. A team rated 80 vs one rated 60 is now 40 vs 20
 * (2× as effective) rather than just 1.33×. Equal teams (both 72) still produce
 * exactly the same λ as without the baseline — it only spreads the outcome
 * distribution for mismatched fixtures.
 */
const STRENGTH_BASELINE = 40;

/**
 * Poisson random variate — how many goals does a team score?
 * lambda is the expected goals value.
 */
function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/** Weighted random pick from an array using a weight function */
function weightedPick<T>(items: T[], weightFn: (item: T) => number): T {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Sort descending by a numeric key function and take the first N */
function topN<T>(arr: T[], n: number, scoreFn: (item: T) => number): T[] {
  return [...arr].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, n);
}

/**
 * Selects the best available XI from a squad pool.
 * Uses a 4-4-2 baseline shape: 1 GK, 4 DEF, 4 MID, 2 FWD.
 * If a position group is thin, fills gaps from overall-ranked remainders.
 */
export function selectBestXI(players: IPlayer[]): IPlayer[] {
  const gks = players.filter((p) => p.positionGroup === 'GK');
  const defs = players.filter((p) => p.positionGroup === 'DEF');
  const mids = players.filter((p) => p.positionGroup === 'MID');
  const fwds = players.filter((p) => p.positionGroup === 'FWD');

  const selectedGK = topN(gks, 1, (p) => p.stats.overall);
  const selectedDEF = topN(defs, 4, (p) => p.stats.defending * 0.7 + p.stats.overall * 0.3);
  const selectedMID = topN(mids, 4, (p) => p.stats.passing * 0.35 + p.stats.overall * 0.5 + p.stats.shooting * 0.15);
  const selectedFWD = topN(fwds, 2, (p) => p.stats.shooting * 0.6 + p.stats.dribbling * 0.2 + p.stats.overall * 0.2);

  const xi = [...selectedGK, ...selectedDEF, ...selectedMID, ...selectedFWD];

  // Fill any gaps (thin squad) from unselected players by overall
  if (xi.length < 11) {
    const selectedIds = new Set(xi.map((p) => String(p._id)));
    const unused = players
      .filter((p) => !selectedIds.has(String(p._id)))
      .sort((a, b) => b.stats.overall - a.stats.overall);
    xi.push(...unused.slice(0, 11 - xi.length));
  }

  return xi;
}

/**
 * Calculates attack and defense ratings from the best XI.
 * All values normalized so equal-quality teams produce ~1.4 xG each.
 */
function teamStrength(players: IPlayer[]): { attack: number; defense: number } {
  if (players.length === 0) return { attack: 72, defense: 72 };

  const xi = players.length <= 11 ? players : selectBestXI(players);

  const gks = xi.filter((p) => p.positionGroup === 'GK');
  const defs = xi.filter((p) => p.positionGroup === 'DEF');
  const mids = xi.filter((p) => p.positionGroup === 'MID');
  const fwds = xi.filter((p) => p.positionGroup === 'FWD');

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 72;

  // Attack: FWDs contribute 65%, MIDs 35%
  const fwdAttack = avg(fwds.map((p) => p.stats.shooting * 0.6 + p.stats.pace * 0.2 + p.stats.dribbling * 0.2));
  const midAttack = avg(mids.map((p) => p.stats.shooting * 0.3 + p.stats.passing * 0.4 + p.stats.overall * 0.3));
  const attack = fwds.length > 0
    ? fwdAttack * 0.65 + midAttack * 0.35
    : midAttack;

  // Defense: DEFs contribute 65%, MIDs 15% (defensive shield), GK 20%
  const defRating = avg(defs.map((p) => p.stats.defending * 0.7 + p.stats.overall * 0.3));
  const midDef = avg(mids.map((p) => p.stats.defending * 0.5 + p.stats.overall * 0.5));
  // GK 'defending' in FC26 is the outfield defending stat (~10–20 for GKs), not GK quality.
  // Use 'overall' directly — it already encodes all GK attributes.
  const gkRating = gks.length > 0 ? gks[0].stats.overall : 72;

  const defense = defs.length > 0
    ? defRating * 0.65 + midDef * 0.15 + gkRating * 0.20
    : midDef * 0.50 + gkRating * 0.50;

  return {
    attack: Math.max(40, attack),
    defense: Math.max(40, defense),
  };
}

export interface SimulatedMatch {
  homeScore: number;
  awayScore: number;
  result: MatchResult;
}

/**
 * Simulates a single match between two teams.
 * Expected goals formula: (attack / defense) * HOME_ADV * BASE_EXPECTED_GOALS
 * Equal teams at ~72 rating produce ~1.4 home / 1.2 away xG — realistic PL averages.
 *
 * @param homeTeamName  Name of the home team
 * @param awayTeamName  Name of the away team
 * @param homePlayers   Players available for the home team (best XI auto-selected if >11)
 * @param awayPlayers   Players available for the away team (best XI auto-selected if >11)
 */
export function simulateMatch(
  homeTeamName: string,
  awayTeamName: string,
  homePlayers: IPlayer[],
  awayPlayers: IPlayer[]
): SimulatedMatch {
  const homeStrength = teamStrength(homePlayers);
  const awayStrength = teamStrength(awayPlayers);

  // Offset both attack and defence by STRENGTH_BASELINE before dividing so that
  // the gap between a 85-rated attack and a 65-rated defence is 45 vs 25 (1.8×)
  // rather than 85 vs 65 (1.3×).  Equal teams are unchanged: ratio = 32/32 = 1.
  const effHomeAtk = Math.max(homeStrength.attack - STRENGTH_BASELINE, 5);
  const effAwayDef = Math.max(awayStrength.defense - STRENGTH_BASELINE, 5);
  const effAwayAtk = Math.max(awayStrength.attack - STRENGTH_BASELINE, 5);
  const effHomeDef = Math.max(homeStrength.defense - STRENGTH_BASELINE, 5);

  const homeLambda = (effHomeAtk / effAwayDef) * HOME_ADVANTAGE * BASE_EXPECTED_GOALS;
  const awayLambda = (effAwayAtk / effHomeDef) * BASE_EXPECTED_GOALS;

  const homeScore = poissonRandom(Math.max(0.3, Math.min(homeLambda, 4.0)));
  const awayScore = poissonRandom(Math.max(0.2, Math.min(awayLambda, 3.5)));

  // Use actual playing XI for goal/card attribution (not full bench)
  const homeXI = homePlayers.length <= 11 ? homePlayers : selectBestXI(homePlayers);
  const awayXI = awayPlayers.length <= 11 ? awayPlayers : selectBestXI(awayPlayers);

  const goals: GoalEvent[] = [];
  const cards: CardEvent[] = [];

  // ── Assign goals ──────────────────────────────────────────────────────────
  const assignGoalsForTeam = (teamName: string, numGoals: number, xi: IPlayer[]) => {
    const scoringCandidates = xi.filter((p) => p.positionGroup !== 'GK');
    if (scoringCandidates.length === 0) return;

    for (let i = 0; i < numGoals; i++) {
      const scorer = weightedPick(scoringCandidates, (p) => {
        const posWeight = p.positionGroup === 'FWD' ? 5 : p.positionGroup === 'MID' ? 2 : 0.5;
        return (p.stats.shooting / 100) * posWeight;
      });

      const assisterCandidates = scoringCandidates.filter((p) => p.apiId !== scorer.apiId);
      let assister: IPlayer | undefined;
      if (assisterCandidates.length > 0 && Math.random() < 0.75) {
        assister = weightedPick(assisterCandidates, (p) => p.stats.passing / 100);
      }

      goals.push({
        scorerName: scorer.name,
        scorerApiId: scorer.apiId,
        assisterName: assister?.name,
        assisterApiId: assister?.apiId,
        team: teamName,
      });
    }
  };

  assignGoalsForTeam(homeTeamName, homeScore, homeXI);
  assignGoalsForTeam(awayTeamName, awayScore, awayXI);

  // ── Assign cards ──────────────────────────────────────────────────────────
  const assignCardsForTeam = (teamName: string, xi: IPlayer[]) => {
    xi.forEach((p) => {
      // Yellow card probability: base 5% + physical aggression factor
      const yellowProb = 0.05 + (p.stats.physical / 100) * 0.06;
      if (Math.random() < yellowProb) {
        cards.push({ playerName: p.name, playerApiId: p.apiId, team: teamName, type: 'yellow' });
        // 4% chance of second yellow → red
        if (Math.random() < 0.04) {
          cards.push({ playerName: p.name, playerApiId: p.apiId, team: teamName, type: 'red' });
        }
      }
    });
  };

  assignCardsForTeam(homeTeamName, homeXI);
  assignCardsForTeam(awayTeamName, awayXI);

  return {
    homeScore,
    awayScore,
    result: { homeScore, awayScore, goals, cards },
  };
}
