import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { GameSession } from '@/models/gameSession.model';
import { Player, IPlayer } from '@/models/player.model';
import { Club } from '@/models/club.model';
import { simulateMatch, selectBestXI } from '@/utils/matchSimulation.util';
import { StandingEntry, PlayerSeasonStats } from '@/types/game.types';

/** Update standings after a match result */
function applyResult(
  standings: StandingEntry[],
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number
): void {
  const homeEntry = standings.find((s) => s.team === homeTeam);
  const awayEntry = standings.find((s) => s.team === awayTeam);
  if (!homeEntry || !awayEntry) return;

  homeEntry.played++;
  awayEntry.played++;
  homeEntry.gf += homeScore;
  homeEntry.ga += awayScore;
  homeEntry.gd = homeEntry.gf - homeEntry.ga;
  awayEntry.gf += awayScore;
  awayEntry.ga += homeScore;
  awayEntry.gd = awayEntry.gf - awayEntry.ga;

  if (homeScore > awayScore) {
    homeEntry.won++;
    homeEntry.points += 3;
    awayEntry.lost++;
  } else if (awayScore > homeScore) {
    awayEntry.won++;
    awayEntry.points += 3;
    homeEntry.lost++;
  } else {
    homeEntry.drawn++;
    homeEntry.points++;
    awayEntry.drawn++;
    awayEntry.points++;
  }
}

/** Get or initialise a player season stats entry */
function getOrCreateStatEntry(
  statsArr: PlayerSeasonStats[],
  player: IPlayer,
  club: string
): PlayerSeasonStats {
  let entry = statsArr.find((s) => s.playerApiId === player.apiId);
  if (!entry) {
    entry = {
      playerId: (player._id as Types.ObjectId).toString(),
      playerApiId: player.apiId,
      playerName: player.name,
      club,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
    };
    statsArr.push(entry);
  }
  return entry;
}

/** Build a representative squad for an AI club using top-rated players from DB */
async function getAISquad(clubName: string): Promise<IPlayer[]> {
  return Player.find({ club: clubName }).sort({ 'stats.overall': -1 }).limit(20);
}

/**
 * Returns the players to use for the user's team in a match.
 * If the session has a full starting XI set, uses those players.
 * Otherwise auto-selects the best XI from the full squad.
 */
function getUserMatchPlayers(session: any): IPlayer[] {
  const squad = session.squad as IPlayer[];
  const xi = session.startingXI as { slotId: string; label: string; positionGroup: string; playerId: any }[];

  if (xi && xi.length === 11) {
    // All 11 slots must have a valid populated player
    const xiPlayers = xi
      .map((slot) => slot.playerId)
      .filter((p): p is IPlayer => p && typeof p === 'object' && 'stats' in p);
    if (xiPlayers.length === 11) return xiPlayers;
  }

  // Fall back to auto best-XI from full squad
  return selectBestXI(squad);
}

/** POST /api/sessions/:sessionId/simulate — Simulate one gameweek */
export async function simulateGameweek(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .populate('squad')
    .populate('startingXI.playerId');
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }
  if (session.phase !== 'season') {
    res.status(409).json({ error: 'Season is not currently in progress' });
    return;
  }

  const nextGW = session.currentGameweek + 1;
  if (nextGW > 38) {
    res.status(409).json({ error: 'All 38 gameweeks have been simulated' });
    return;
  }

  const gwFixtures = session.fixtures.filter((f) => f.gameweek === nextGW && !f.result);
  if (gwFixtures.length === 0) {
    res.status(409).json({ error: `No unplayed fixtures found for GW${nextGW}` });
    return;
  }

  const userMatchPlayers = getUserMatchPlayers(session);
  const matchResults = [];

  for (const fixture of gwFixtures) {
    const isUserHome = fixture.homeTeam === session.userTeam;
    const isUserAway = fixture.awayTeam === session.userTeam;

    const homePlayers = isUserHome ? userMatchPlayers : await getAISquad(fixture.homeTeam);
    const awayPlayers = isUserAway ? userMatchPlayers : await getAISquad(fixture.awayTeam);

    const sim = simulateMatch(fixture.homeTeam, fixture.awayTeam, homePlayers, awayPlayers);

    // Store result in fixture
    fixture.result = sim.result;

    // Update standings
    applyResult(
      session.standings as StandingEntry[],
      fixture.homeTeam,
      fixture.awayTeam,
      sim.homeScore,
      sim.awayScore
    );

    // Update player season stats
    const allPlayers = [...homePlayers, ...awayPlayers];
    const statsArr = session.playerSeasonStats as PlayerSeasonStats[];

    sim.result.goals.forEach((goal) => {
      const scorer = allPlayers.find((p) => p.apiId === goal.scorerApiId);
      if (scorer) {
        const entry = getOrCreateStatEntry(statsArr, scorer, goal.team);
        entry.goals++;
      }
      if (goal.assisterApiId) {
        const assister = allPlayers.find((p) => p.apiId === goal.assisterApiId);
        if (assister) {
          const entry = getOrCreateStatEntry(statsArr, assister, goal.team);
          entry.assists++;
        }
      }
    });

    sim.result.cards.forEach((card) => {
      const player = allPlayers.find((p) => p.apiId === card.playerApiId);
      if (player) {
        const entry = getOrCreateStatEntry(statsArr, player, card.team);
        if (card.type === 'yellow') entry.yellowCards++;
        else entry.redCards++;
      }
    });

    // Clean sheets: GKs on the side that conceded 0
    if (sim.homeScore === 0) {
      awayPlayers.filter((p) => p.positionGroup === 'GK').forEach((gk) => {
        const entry = getOrCreateStatEntry(statsArr, gk, fixture.awayTeam);
        entry.cleanSheets++;
      });
    }
    if (sim.awayScore === 0) {
      homePlayers.filter((p) => p.positionGroup === 'GK').forEach((gk) => {
        const entry = getOrCreateStatEntry(statsArr, gk, fixture.homeTeam);
        entry.cleanSheets++;
      });
    }

    matchResults.push({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeScore: sim.homeScore,
      awayScore: sim.awayScore,
      goals: sim.result.goals,
    });
  }

  session.currentGameweek = nextGW;

  // After GW19, open January transfer window
  if (nextGW === 19) {
    session.phase = 'january_transfer';
  } else if (nextGW === 38) {
    session.phase = 'season_end';
  }

  // Sort standings by points (then GD, then GF)
  (session.standings as StandingEntry[]).sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );

  session.markModified('fixtures');
  session.markModified('standings');
  session.markModified('playerSeasonStats');
  await session.save();

  res.json({
    gameweek: nextGW,
    phase: session.phase,
    matches: matchResults,
    userStanding: (session.standings as StandingEntry[]).findIndex(
      (s) => s.team === session.userTeam
    ) + 1,
  });
}

/** POST /api/sessions/:sessionId/simulate-all — Simulate all remaining gameweeks */
export async function simulateAll(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .populate('squad')
    .populate('startingXI.playerId');
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }
  if (session.phase !== 'season') {
    res.status(409).json({ error: 'Season is not currently in progress' });
    return;
  }

  const startGW = session.currentGameweek + 1;
  const endGW = 38;

  if (startGW > endGW) {
    res.status(409).json({ error: 'All gameweeks already simulated' });
    return;
  }

  const userMatchPlayers = getUserMatchPlayers(session);

  for (let gw = startGW; gw <= endGW; gw++) {
    const gwFixtures = session.fixtures.filter((f) => f.gameweek === gw && !f.result);

    for (const fixture of gwFixtures) {
      const isUserHome = fixture.homeTeam === session.userTeam;
      const isUserAway = fixture.awayTeam === session.userTeam;

      const homePlayers = isUserHome ? userMatchPlayers : await getAISquad(fixture.homeTeam);
      const awayPlayers = isUserAway ? userMatchPlayers : await getAISquad(fixture.awayTeam);

      const sim = simulateMatch(fixture.homeTeam, fixture.awayTeam, homePlayers, awayPlayers);
      fixture.result = sim.result;

      applyResult(
        session.standings as StandingEntry[],
        fixture.homeTeam,
        fixture.awayTeam,
        sim.homeScore,
        sim.awayScore
      );

      const allPlayers = [...homePlayers, ...awayPlayers];
      const statsArr = session.playerSeasonStats as PlayerSeasonStats[];

      sim.result.goals.forEach((goal) => {
        const scorer = allPlayers.find((p) => p.apiId === goal.scorerApiId);
        if (scorer) getOrCreateStatEntry(statsArr, scorer, goal.team).goals++;
        if (goal.assisterApiId) {
          const assister = allPlayers.find((p) => p.apiId === goal.assisterApiId);
          if (assister) getOrCreateStatEntry(statsArr, assister, goal.team).assists++;
        }
      });

      sim.result.cards.forEach((card) => {
        const p = allPlayers.find((pl) => pl.apiId === card.playerApiId);
        if (p) {
          const entry = getOrCreateStatEntry(statsArr, p, card.team);
          if (card.type === 'yellow') entry.yellowCards++;
          else entry.redCards++;
        }
      });

      if (sim.homeScore === 0) {
        awayPlayers.filter((p) => p.positionGroup === 'GK').forEach((gk) => {
          getOrCreateStatEntry(session.playerSeasonStats as PlayerSeasonStats[], gk, fixture.awayTeam).cleanSheets++;
        });
      }
      if (sim.awayScore === 0) {
        homePlayers.filter((p) => p.positionGroup === 'GK').forEach((gk) => {
          getOrCreateStatEntry(session.playerSeasonStats as PlayerSeasonStats[], gk, fixture.homeTeam).cleanSheets++;
        });
      }
    }

    session.currentGameweek = gw;

    if (gw === 19 && session.phase === 'season') {
      session.phase = 'january_transfer';
      // Persist and stop — January window must be handled before continuing
      break;
    }
  }

  if (session.currentGameweek === 38) {
    session.phase = 'season_end';
  }

  (session.standings as StandingEntry[]).sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );

  session.markModified('fixtures');
  session.markModified('standings');
  session.markModified('playerSeasonStats');
  await session.save();

  res.json({
    simulatedUpTo: session.currentGameweek,
    phase: session.phase,
    message:
      session.phase === 'january_transfer'
        ? 'Simulated up to GW19. January transfer window is now open.'
        : 'Season complete!',
  });
}

/** GET /api/sessions/:sessionId/standings */
export async function getStandings(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .select('standings userTeam currentGameweek phase')
    .lean();

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  res.json({
    standings: session.standings,
    userTeam: session.userTeam,
    currentGameweek: session.currentGameweek,
    phase: session.phase,
  });
}

/** GET /api/sessions/:sessionId/stats */
export async function getSeasonStats(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .select('playerSeasonStats userTeam currentGameweek')
    .lean();

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  const stats = session.playerSeasonStats as PlayerSeasonStats[];

  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const topAssists = [...stats].sort((a, b) => b.assists - a.assists).slice(0, 10);
  const topCleanSheets = [...stats]
    .filter((s) => s.cleanSheets > 0)
    .sort((a, b) => b.cleanSheets - a.cleanSheets)
    .slice(0, 5);

  res.json({
    topScorers,
    topAssists,
    topCleanSheets,
    userTeam: session.userTeam,
    currentGameweek: session.currentGameweek,
  });
}
