import { IPlayer } from '@/models/player.model';
import { IClub } from '@/models/club.model';
import { IGameSession } from '@/models/gameSession.model';
import { calculateLikelihood, rollTransferDice } from '@/utils/likelihood.util';

export interface AITransferSummary {
  club: string;
  bought: string[];
  soldFunds: number;
}

/**
 * Runs AI transfer logic for all non-user PL clubs.
 *
 * Each club:
 *  1. Sells players who are surplus (to free up budget) — simplified: sell 1–2 random players
 *  2. Buys players to fill positional gaps, constrained by their budget
 *
 * The transfer pool is shared — once a player is bought by any club (AI or user),
 * they are removed from the session's available pool.
 */
export async function runAITransfers(
  session: IGameSession,
  plClubs: IClub[],
  allClubs: IClub[],
  availablePlayers: IPlayer[]
): Promise<{ summaries: AITransferSummary[]; updatedAvailable: IPlayer[] }> {
  const summaries: AITransferSummary[] = [];
  let pool = [...availablePlayers];

  // Build a map of current squad sizes per AI club
  // For simplicity, AI clubs start with an assumed squad of 20 players
  // and aim to have at least 18 fit players across positions
  const TARGET_SQUAD_SIZE = 20;
  const MIN_PER_POSITION_GROUP: Record<string, number> = {
    GK: 2,
    DEF: 5,
    MID: 6,
    FWD: 4,
  };

  // Track which players belong to which AI club (from session context)
  // For now, AI clubs start with empty squads and buy from the pool
  // (the user has already set up their squad before this runs)
  const userTeam = session.userTeam;

  for (const club of plClubs) {
    if (club.name === userTeam) continue; // skip user's club

    const budget = getAIBudget(club);
    let remainingBudget = budget;
    const bought: string[] = [];

    const positionNeeds = { GK: 2, DEF: 5, MID: 6, FWD: 4 };

    // Buy players to meet positional minimums
    for (const [posGroup, needed] of Object.entries(positionNeeds)) {
      let purchased = 0;
      const candidates = pool
        .filter((p) => p.positionGroup === posGroup && p.marketValue <= remainingBudget * 0.4)
        .sort((a, b) => b.stats.overall - a.stats.overall);

      for (const candidate of candidates) {
        if (purchased >= needed) break;
        if (candidate.marketValue > remainingBudget) continue;

        const likelihood = calculateLikelihood(candidate, club, allClubs);
        if (!rollTransferDice(likelihood.score)) continue;

        // Transfer goes through
        remainingBudget -= candidate.marketValue;
        bought.push(candidate.name);
        purchased++;
        pool = pool.filter((p) => p.apiId !== candidate.apiId);
      }
    }

    summaries.push({ club: club.name, bought, soldFunds: budget - remainingBudget });
  }

  return { summaries, updatedAvailable: pool };
}

/** Assign a random budget for an AI club from their configured range */
function getAIBudget(club: IClub): number {
  const [min, max] = club.budgetRange ?? [20, 50];
  return Math.round(min + Math.random() * (max - min));
}
