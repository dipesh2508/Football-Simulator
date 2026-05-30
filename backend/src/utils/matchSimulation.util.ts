import { IPlayer } from '@/models/player.model';
import { MatchResult, GoalEvent, CardEvent, SubstitutionEvent, TeamStrengthScore, PositionGroup } from '@/types/game.types';

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

/** Out-of-position penalty: 12% reduction on the player's positional contribution */
const ALT_POSITION_PENALTY = 0.88;

/** ~18% of goals are penalties */
const PENALTY_GOAL_RATE = 0.18;

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
 * Parses a formation string like "4-3-3" into per-group slot counts.
 * Returns { GK, DEF, MID, FWD }.
 */
function parseFormationCounts(formation: string): Record<PositionGroup, number> {
  const parts = formation.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    // Standard N-N-N: DEF-MID-FWD (GK always 1)
    return { GK: 1, DEF: parts[0], MID: parts[1], FWD: parts[2] };
  }
  // Fallback to 4-4-2
  return { GK: 1, DEF: 4, MID: 4, FWD: 2 };
}

/** Maps a Position to its PositionGroup */
function positionToGroup(pos: string): PositionGroup {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM') return 'MID';
  return 'FWD';
}

/**
 * Tagged player used internally — carries an isAltPosition flag for
 * the penalty calculation in teamStrength.
 */
interface TaggedPlayer {
  player: IPlayer;
  isAltPosition: boolean;
}

/**
 * Selects the best available XI from a squad pool, formation-aware.
 * When a group is short, first tries players whose altPositions map to that group
 * (tagged as isAltPosition), then falls back to any unselected player by overall.
 */
export function selectBestXI(players: IPlayer[], formation = '4-4-2'): IPlayer[] {
  return selectBestXITagged(players, formation).map((t) => t.player);
}

function selectBestXITagged(players: IPlayer[], formation = '4-4-2'): TaggedPlayer[] {
  const counts = parseFormationCounts(formation);
  const selected: TaggedPlayer[] = [];
  const usedIds = new Set<string>();

  const pickGroup = (group: PositionGroup, needed: number, scoreFn: (p: IPlayer) => number) => {
    // Primary: players whose positionGroup matches
    const primary = players
      .filter((p) => p.positionGroup === group && !usedIds.has(String(p._id)))
      .sort((a, b) => scoreFn(b) - scoreFn(a))
      .slice(0, needed);

    primary.forEach((p) => {
      selected.push({ player: p, isAltPosition: false });
      usedIds.add(String(p._id));
    });

    let remaining = needed - primary.length;
    if (remaining <= 0) return;

    // Alt-position fill: players whose altPositions include a position mapping to this group
    const altCandidates = players
      .filter((p) => !usedIds.has(String(p._id)) && p.altPositions?.some((ap) => positionToGroup(ap) === group))
      .sort((a, b) => scoreFn(b) - scoreFn(a))
      .slice(0, remaining);

    altCandidates.forEach((p) => {
      selected.push({ player: p, isAltPosition: true });
      usedIds.add(String(p._id));
    });

    remaining -= altCandidates.length;
    if (remaining <= 0) return;

    // Final fallback: any unselected player by overall
    const fallbacks = players
      .filter((p) => !usedIds.has(String(p._id)))
      .sort((a, b) => b.stats.overall - a.stats.overall)
      .slice(0, remaining);

    fallbacks.forEach((p) => {
      selected.push({ player: p, isAltPosition: true });
      usedIds.add(String(p._id));
    });
  };

  pickGroup('GK', counts.GK, (p) => p.stats.overall);
  pickGroup('DEF', counts.DEF, (p) => p.stats.defending * 0.7 + p.stats.overall * 0.3);
  pickGroup('MID', counts.MID, (p) => p.stats.passing * 0.35 + p.stats.overall * 0.5 + p.stats.shooting * 0.15);
  pickGroup('FWD', counts.FWD, (p) => p.stats.shooting * 0.6 + p.stats.dribbling * 0.2 + p.stats.overall * 0.2);

  // If we still have fewer than 11, top up by overall
  if (selected.length < 11) {
    players
      .filter((p) => !usedIds.has(String(p._id)))
      .sort((a, b) => b.stats.overall - a.stats.overall)
      .slice(0, 11 - selected.length)
      .forEach((p) => {
        selected.push({ player: p, isAltPosition: true });
        usedIds.add(String(p._id));
      });
  }

  return selected.slice(0, 11);
}

/**
 * Calculates attack, midfield and defense ratings from a squad/XI.
 * Applies ALT_POSITION_PENALTY on out-of-position players.
 * Exported as calculateTeamStrengthScore for use in the teams endpoint.
 */
export function calculateTeamStrengthScore(players: IPlayer[], formation = '4-4-2'): TeamStrengthScore {
  if (players.length === 0) return { attack: 72, midfield: 72, defence: 72, overall: 72 };

  const tagged = players.length <= 11
    ? players.map((p) => ({ player: p, isAltPosition: false }))
    : selectBestXITagged(players, formation);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 72;
  const pen = (tagged: TaggedPlayer, val: number) => tagged.isAltPosition ? val * ALT_POSITION_PENALTY : val;

  const gkTagged  = tagged.filter((t) => t.player.positionGroup === 'GK');
  const defTagged = tagged.filter((t) => t.player.positionGroup === 'DEF' || (t.isAltPosition && t.player.altPositions?.some((p) => positionToGroup(p) === 'DEF')));
  const midTagged = tagged.filter((t) => t.player.positionGroup === 'MID' || (t.isAltPosition && t.player.altPositions?.some((p) => positionToGroup(p) === 'MID')));
  const fwdTagged = tagged.filter((t) => t.player.positionGroup === 'FWD' || (t.isAltPosition && t.player.altPositions?.some((p) => positionToGroup(p) === 'FWD')));

  // Use actual slot assignment for tagged filtering: simpler approach — filter by what was selected
  const gks  = tagged.filter((t) => gkTagged.some((g) => String(g.player._id) === String(t.player._id)));
  const defs = tagged.filter((t) => !gks.includes(t) && (t.player.positionGroup === 'DEF' || t.isAltPosition));
  const mids = tagged.filter((t) => !gks.includes(t) && !defs.includes(t) && t.player.positionGroup === 'MID');
  const fwds = tagged.filter((t) => !gks.includes(t) && !defs.includes(t) && !mids.includes(t));

  // Re-derive from formation counts for clean slot allocation
  const counts = parseFormationCounts(formation);
  const slots: TaggedPlayer[][] = [[], [], [], []]; // GK, DEF, MID, FWD
  const groupOrder: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
  let idx = 0;
  for (let g = 0; g < 4; g++) {
    for (let s = 0; s < counts[groupOrder[g]]; s++) {
      if (tagged[idx]) slots[g].push(tagged[idx++]);
    }
  }
  while (idx < tagged.length) slots[3].push(tagged[idx++]);

  const gkSlots  = slots[0];
  const defSlots = slots[1];
  const midSlots = slots[2];
  const fwdSlots = slots[3];

  const fwdAttack = avg(fwdSlots.map((t) => pen(t, t.player.stats.shooting * 0.6 + t.player.stats.pace * 0.2 + t.player.stats.dribbling * 0.2)));
  const midAttack = avg(midSlots.map((t) => pen(t, t.player.stats.shooting * 0.3 + t.player.stats.passing * 0.4 + t.player.stats.overall * 0.3)));
  const attack = fwdSlots.length > 0
    ? Math.max(40, fwdAttack * 0.65 + midAttack * 0.35)
    : Math.max(40, midAttack);

  const midfield = Math.max(40, avg(midSlots.map((t) => pen(t, t.player.stats.passing * 0.4 + t.player.stats.dribbling * 0.25 + t.player.stats.overall * 0.35))));

  const defRating = avg(defSlots.map((t) => pen(t, t.player.stats.defending * 0.7 + t.player.stats.overall * 0.3)));
  const midDef    = avg(midSlots.map((t) => pen(t, t.player.stats.defending * 0.5 + t.player.stats.overall * 0.5)));
  const gkRating  = gkSlots.length > 0 ? gkSlots[0].player.stats.overall : 72;
  const defence = defSlots.length > 0
    ? Math.max(40, defRating * 0.65 + midDef * 0.15 + gkRating * 0.20)
    : Math.max(40, midDef * 0.50 + gkRating * 0.50);

  const overall = Math.round((attack + midfield + defence) / 3);

  return {
    attack: Math.round(attack),
    midfield: Math.round(midfield),
    defence: Math.round(defence),
    overall,
  };
}

// Legacy export used by season.controller — returns { attack, defense } shape
function teamStrength(players: IPlayer[], formation = '4-4-2'): { attack: number; defense: number } {
  const score = calculateTeamStrengthScore(players, formation);
  return { attack: score.attack, defense: score.defence };
}

export interface SimulatedMatch {
  homeScore: number;
  awayScore: number;
  result: MatchResult;
  /** All players who appeared (starting XI + subs) — for appearances tracking */
  homeAppearances: IPlayer[];
  awayAppearances: IPlayer[];
}

/**
 * Simulates a single match between two teams.
 *
 * @param homeTeamName  Name of the home team
 * @param awayTeamName  Name of the away team
 * @param homePlayers   Full squad for home team (best XI auto-selected if >11)
 * @param awayPlayers   Full squad for away team (best XI auto-selected if >11)
 * @param homeFormation Formation string for home team (default 4-4-2)
 * @param awayFormation Formation string for away team (default 4-4-2)
 */
export function simulateMatch(
  homeTeamName: string,
  awayTeamName: string,
  homePlayers: IPlayer[],
  awayPlayers: IPlayer[],
  homeFormation = '4-4-2',
  awayFormation = '4-4-2'
): SimulatedMatch {
  const homeStrength = teamStrength(homePlayers, homeFormation);
  const awayStrength = teamStrength(awayPlayers, awayFormation);

  const effHomeAtk = Math.max(homeStrength.attack - STRENGTH_BASELINE, 5);
  const effAwayDef = Math.max(awayStrength.defense - STRENGTH_BASELINE, 5);
  const effAwayAtk = Math.max(awayStrength.attack - STRENGTH_BASELINE, 5);
  const effHomeDef = Math.max(homeStrength.defense - STRENGTH_BASELINE, 5);

  const homeLambda = (effHomeAtk / effAwayDef) * HOME_ADVANTAGE * BASE_EXPECTED_GOALS;
  const awayLambda = (effAwayAtk / effHomeDef) * BASE_EXPECTED_GOALS;

  const homeScore = poissonRandom(Math.max(0.3, Math.min(homeLambda, 4.0)));
  const awayScore = poissonRandom(Math.max(0.2, Math.min(awayLambda, 3.5)));

  // Use actual playing XI for goal/card attribution
  const homeXI = homePlayers.length <= 11 ? homePlayers : selectBestXI(homePlayers, homeFormation);
  const awayXI = awayPlayers.length <= 11 ? awayPlayers : selectBestXI(awayPlayers, awayFormation);

  const goals: GoalEvent[] = [];
  const cards: CardEvent[] = [];
  const substitutions: SubstitutionEvent[] = [];

  // ── Assign goals ──────────────────────────────────────────────────────────
  const assignGoalsForTeam = (teamName: string, numGoals: number, xi: IPlayer[]) => {
    const scoringCandidates = xi.filter((p) => p.positionGroup !== 'GK');
    if (scoringCandidates.length === 0) return;

    for (let i = 0; i < numGoals; i++) {
      const isPenalty = Math.random() < PENALTY_GOAL_RATE;

      let scorer: IPlayer;
      if (isPenalty) {
        // Penalty takers: prefer FWD, then CAM, then anyone
        const penaltyCandidates = scoringCandidates.filter(
          (p) => p.positionGroup === 'FWD' || p.position === 'CAM'
        );
        const pool = penaltyCandidates.length > 0 ? penaltyCandidates : scoringCandidates;
        scorer = weightedPick(pool, (p) => p.stats.shooting / 100);
      } else {
        scorer = weightedPick(scoringCandidates, (p) => {
          const posWeight = p.positionGroup === 'FWD' ? 5 : p.positionGroup === 'MID' ? 2 : 0.5;
          return (p.stats.shooting / 100) * posWeight;
        });
      }

      const assisterCandidates = scoringCandidates.filter((p) => p.apiId !== scorer.apiId);
      let assister: IPlayer | undefined;
      // Penalties rarely have a credited assist (25% chance)
      const assistChance = isPenalty ? 0.25 : 0.75;
      if (assisterCandidates.length > 0 && Math.random() < assistChance) {
        assister = weightedPick(assisterCandidates, (p) => p.stats.passing / 100);
      }

      goals.push({
        scorerName: scorer.shortName,
        scorerApiId: scorer.apiId,
        assisterName: assister?.shortName,
        assisterApiId: assister?.apiId,
        team: teamName,
        isPenalty,
      });
    }
  };

  assignGoalsForTeam(homeTeamName, homeScore, homeXI);
  assignGoalsForTeam(awayTeamName, awayScore, awayXI);

  // ── Assign cards ──────────────────────────────────────────────────────────
  const assignCardsForTeam = (teamName: string, xi: IPlayer[]) => {
    xi.forEach((p) => {
      const yellowProb = 0.05 + (p.stats.physical / 100) * 0.06;
      if (Math.random() < yellowProb) {
        cards.push({ playerName: p.name, playerApiId: p.apiId, team: teamName, type: 'yellow' });
        if (Math.random() < 0.04) {
          cards.push({ playerName: p.name, playerApiId: p.apiId, team: teamName, type: 'red' });
        }
      }
    });
  };

  assignCardsForTeam(homeTeamName, homeXI);
  assignCardsForTeam(awayTeamName, awayXI);

  // ── Simulate substitutions ────────────────────────────────────────────────
  const homeAppearances: IPlayer[] = [...homeXI];
  const awayAppearances: IPlayer[] = [...awayXI];

  const simulateSubstitutions = (
    teamName: string,
    xi: IPlayer[],
    fullSquad: IPlayer[],
    appearances: IPlayer[]
  ) => {
    const bench = fullSquad.filter((p) => !xi.some((s) => String(s._id) === String(p._id)));
    if (bench.length === 0) return;

    const numSubs = 2 + Math.floor(Math.random() * 2); // 2 or 3 subs
    const xiPool = [...xi].filter((p) => p.positionGroup !== 'GK'); // GKs rarely subbed
    const usedBench = new Set<string>();
    const usedOff = new Set<string>();

    for (let i = 0; i < numSubs && bench.length > 0; i++) {
      const minute = 55 + Math.floor(Math.random() * 31); // 55–85'

      // Pick a random outfield XI player to come off
      const offCandidates = xiPool.filter((p) => !usedOff.has(String(p._id)));
      if (offCandidates.length === 0) break;
      const playerOff = offCandidates[Math.floor(Math.random() * offCandidates.length)];
      usedOff.add(String(playerOff._id));

      // Pick best available bench player from same position group (or any)
      const samePosGroup = bench.filter(
        (p) => p.positionGroup === playerOff.positionGroup && !usedBench.has(String(p._id))
      );
      const subPool = samePosGroup.length > 0
        ? samePosGroup
        : bench.filter((p) => !usedBench.has(String(p._id)));
      if (subPool.length === 0) break;

      const playerOn = topN(subPool, 1, (p) => p.stats.overall)[0];
      usedBench.add(String(playerOn._id));

      substitutions.push({
        playerOffName: playerOff.name,
        playerOffApiId: playerOff.apiId,
        playerOnName: playerOn.name,
        playerOnApiId: playerOn.apiId,
        team: teamName,
        minute,
      });

      appearances.push(playerOn);

      // Substitute can score/assist for remaining time (weighted by time on pitch)
      const timeWeight = (90 - minute) / 90;
      if (Math.random() < timeWeight * 0.25 && playerOn.positionGroup !== 'GK') {
        const isPenalty = Math.random() < PENALTY_GOAL_RATE;
        goals.push({
          scorerName: playerOn.shortName,
          scorerApiId: playerOn.apiId,
          team: teamName,
          isPenalty,
        });
        if (teamName === homeTeamName) {
          // These bonus goals do NOT change the match score — they are narrative only
          // (score was already determined by Poisson). We skip modifying homeScore/awayScore.
        }
      }
    }
  };

  simulateSubstitutions(homeTeamName, homeXI, homePlayers, homeAppearances);
  simulateSubstitutions(awayTeamName, awayXI, awayPlayers, awayAppearances);

  return {
    homeScore,
    awayScore,
    result: { homeScore, awayScore, goals, cards, substitutions },
    homeAppearances,
    awayAppearances,
  };
}
