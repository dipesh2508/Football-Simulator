import { IPlayer } from '@/models/player.model';
import { IClub } from '@/models/club.model';
import { LikelihoodLabel, LikelihoodResult } from '@/types/game.types';

/**
 * Calculates the likelihood (0–100) of a player agreeing to join the target club.
 *
 * Factors:
 *  - Reputation gap between target club and player's current club
 *  - Player age (older players are more flexible)
 *  - Club affinity / anti-affinity
 *  - League prestige (PL is top destination)
 *  - Free agent bonus
 */
export function calculateLikelihood(
  player: IPlayer,
  targetClub: IClub,
  allClubs: IClub[]
): LikelihoodResult {
  const currentClub = allClubs.find((c) => c.name === player.club);
  const currentReputation = currentClub?.reputation ?? 5;
  const targetReputation = targetClub.reputation;

  let score = 50; // neutral baseline

  // ── Reputation gap ────────────────────────────────────────────────────────
  // Positive = player is moving up / sideways → more likely
  // Negative = player is moving down → less likely
  const repGap = targetReputation - currentReputation;
  score += repGap * 8;

  // ── Age factor ────────────────────────────────────────────────────────────
  // Young stars (≤22) only go to elite clubs; veterans (≥31) are flexible
  if (player.age <= 21) {
    // Very young — only moves to significantly better clubs
    if (repGap < 1) score -= 20;
  } else if (player.age <= 24) {
    if (repGap < 0) score -= 12;
  } else if (player.age >= 31) {
    // Veterans accept lateral or downward moves more readily
    score += 10;
  } else if (player.age >= 34) {
    score += 18;
  }

  // ── Affinity ─────────────────────────────────────────────────────────────
  if (player.antiAffinityClubs.includes(targetClub.name)) {
    score -= 45; // hard veto (e.g. Yamal to Real Madrid)
  } else if (player.affinityClubs.includes(targetClub.name)) {
    score += 22; // former club, dream club, etc.
  }

  // ── League prestige bonus ─────────────────────────────────────────────────
  // Players from non-PL leagues get a boost for joining the PL
  if (targetClub.isPL && !currentClub?.isPL) {
    score += 10;
  }

  // ── Free agent bonus ──────────────────────────────────────────────────────
  if (player.isFreeAgent) {
    score += 25;
  }

  // ── Market value vs club budget sanity check ──────────────────────────────
  // If the target club's expected budget ceiling is very low vs player value,
  // the move is unlikely regardless of willingness
  const budgetCeiling = targetClub.budgetRange?.[1] ?? 200;
  if (player.marketValue > budgetCeiling * 1.5) {
    score -= 20;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
  };
}

function scoreToLabel(score: number): LikelihoodLabel {
  if (score >= 80) return 'certain';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 15) return 'low';
  return 'impossible';
}

/**
 * Roll the dice on whether a transfer deal succeeds based on likelihood score.
 * Returns true if the deal goes through.
 */
export function rollTransferDice(likelihood: number): boolean {
  const roll = Math.random() * 100;
  return roll <= likelihood;
}
