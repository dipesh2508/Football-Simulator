import { IPlayer } from '@/models/player.model';
import { IClub } from '@/models/club.model';
import { IGameSession } from '@/models/gameSession.model';
import { calculateLikelihood, rollTransferDice } from '@/utils/likelihood.util';
import { Types } from 'mongoose';

export interface AITransferSummary {
  club: string;
  bought: string[];
  soldFunds: number;
}

/**
 * Runs AI transfer logic for all non-user PL clubs.
 * Returns summaries of activity AND a map of each AI club → array of bought player ObjectIds
 * (used to persist session.aiSquads after the window closes).
 */
export async function runAITransfers(
  session: IGameSession,
  plClubs: IClub[],
  allClubs: IClub[],
  availablePlayers: IPlayer[]
): Promise<{
  summaries: AITransferSummary[];
  updatedAvailable: IPlayer[];
  clubBought: Map<string, Types.ObjectId[]>;
}> {
  const summaries: AITransferSummary[] = [];
  const clubBought = new Map<string, Types.ObjectId[]>();
  let pool = [...availablePlayers];

  const userTeam = session.userTeam;

  for (const club of plClubs) {
    if (club.name === userTeam) continue;

    const budget = getAIBudget(club);
    let remainingBudget = budget;
    const bought: string[] = [];
    const boughtIds: Types.ObjectId[] = [];

    const positionNeeds = { GK: 2, DEF: 5, MID: 6, FWD: 4 };

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

        remainingBudget -= candidate.marketValue;
        bought.push(candidate.shortName);
        boughtIds.push(candidate._id as Types.ObjectId);
        purchased++;
        pool = pool.filter((p) => p.apiId !== candidate.apiId);
      }
    }

    summaries.push({ club: club.name, bought, soldFunds: budget - remainingBudget });
    if (boughtIds.length > 0) clubBought.set(club.name, boughtIds);
  }

  return { summaries, updatedAvailable: pool, clubBought };
}

/** Assign a random budget for an AI club from their configured range */
function getAIBudget(club: IClub): number {
  const [min, max] = club.budgetRange ?? [20, 50];
  return Math.round(min + Math.random() * (max - min));
}
