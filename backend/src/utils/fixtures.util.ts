import { Fixture } from '@/types/game.types';

/**
 * Generates a full round-robin home + away fixture list for a 20-team Premier League season.
 * 38 gameweeks, 10 matches per gameweek, 380 total matches.
 *
 * Uses the circle rotation algorithm for round-robin scheduling.
 */
export function generateFixtures(teams: string[]): Fixture[] {
  if (teams.length !== 20) {
    throw new Error(`Expected 20 teams, got ${teams.length}`);
  }

  const fixtures: Fixture[] = [];
  const n = teams.length;
  const rounds = n - 1; // 19 rounds for home leg
  const perRound = n / 2; // 10 matches per round

  // First leg (home round-robin)
  const rotatingTeams = [...teams];
  const pivot = rotatingTeams.shift()!; // Pin team[0], rotate the rest

  for (let round = 0; round < rounds; round++) {
    const roundTeams = [pivot, ...rotatingTeams];
    const gameweek = round + 1;

    for (let match = 0; match < perRound; match++) {
      const home = roundTeams[match];
      const away = roundTeams[n - 1 - match];
      fixtures.push({ gameweek, homeTeam: home, awayTeam: away });
    }

    // Rotate: move last element to position 1 (after pivot)
    rotatingTeams.unshift(rotatingTeams.pop()!);
  }

  // Second leg (reverse home/away, gameweeks 20–38)
  const firstLeg = [...fixtures];
  firstLeg.forEach((f) => {
    fixtures.push({
      gameweek: f.gameweek + rounds,
      homeTeam: f.awayTeam,
      awayTeam: f.homeTeam,
    });
  });

  return fixtures;
}
