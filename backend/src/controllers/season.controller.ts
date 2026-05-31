import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { GameSession } from '@/models/gameSession.model';
import { Player, IPlayer } from '@/models/player.model';
import { Club } from '@/models/club.model';
import { simulateMatch, selectBestXI, calculateTeamStrengthScore } from '@/utils/matchSimulation.util';
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
      playerName: player.shortName,
      club,
      appearances: 0,
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

/**
 * Build a representative squad for an AI club.
 * Uses session-aware aiSquads if available; falls back to DB top-20.
 */
async function getAISquad(clubName: string, session: any): Promise<IPlayer[]> {
  const aiSquads = session.aiSquads as Map<string, Types.ObjectId[]> | undefined;
  if (aiSquads) {
    const ids = aiSquads.get(clubName);
    if (ids && ids.length > 0) {
      return Player.find({ _id: { $in: ids } }).sort({ 'stats.overall': -1 }).limit(20);
    }
  }
  return Player.find({ club: clubName }).sort({ 'stats.overall': -1 }).limit(20);
}

/**
 * Returns the players to use for the user's team in a match.
 * If the session has a full starting XI set, uses those players.
 * Otherwise auto-selects the best XI from the full squad.
 */
function getUserMatchPlayers(session: any): IPlayer[] {
  const squad = session.squad as unknown as IPlayer[];
  const xi = session.startingXI as { slotId: string; label: string; positionGroup: string; playerId: any }[];

  if (xi && xi.length === 11) {
    const xiPlayers = xi
      .map((slot) => slot.playerId)
      .filter((p): p is IPlayer => p && typeof p === 'object' && 'stats' in p);
    if (xiPlayers.length === 11) return xiPlayers;
  }

  return selectBestXI(squad, session.formation || '4-4-2');
}

/** Returns the full squad (bench included) for substitution simulation */
function getUserFullSquad(session: any): IPlayer[] {
  return session.squad as unknown as IPlayer[];
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
  const userFullSquad = getUserFullSquad(session);
  const userFormation = (session as any).formation || '4-4-2';
  const matchResults = [];

  for (const fixture of gwFixtures) {
    const isUserHome = fixture.homeTeam === session.userTeam;
    const isUserAway = fixture.awayTeam === session.userTeam;

    const homePlayers = isUserHome ? userMatchPlayers : await getAISquad(fixture.homeTeam, session);
    const awayPlayers = isUserAway ? userMatchPlayers : await getAISquad(fixture.awayTeam, session);
    const homeFullSquad = isUserHome ? userFullSquad : homePlayers;
    const awayFullSquad = isUserAway ? userFullSquad : awayPlayers;

    const sim = simulateMatch(
      fixture.homeTeam, fixture.awayTeam,
      homeFullSquad, awayFullSquad,
      isUserHome ? userFormation : '4-4-2',
      isUserAway ? userFormation : '4-4-2'
    );

    fixture.result = sim.result;

    applyResult(
      session.standings as StandingEntry[],
      fixture.homeTeam,
      fixture.awayTeam,
      sim.homeScore,
      sim.awayScore
    );

    const statsArr = session.playerSeasonStats as PlayerSeasonStats[];

    // Appearances: everyone who played (starting XI + subs who came on)
    sim.homeAppearances.forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.homeTeam).appearances++; });
    sim.awayAppearances.forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.awayTeam).appearances++; });

    // Goals & assists
    sim.result.goals.forEach((goal) => {
      const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
      const scorer = allAppearances.find((p) => p.apiId === goal.scorerApiId);
      if (scorer) getOrCreateStatEntry(statsArr, scorer, goal.team).goals++;
      if (goal.assisterApiId) {
        const assister = allAppearances.find((p) => p.apiId === goal.assisterApiId);
        if (assister) getOrCreateStatEntry(statsArr, assister, goal.team).assists++;
      }
    });

    // Cards
    sim.result.cards.forEach((card) => {
      const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
      const player = allAppearances.find((p) => p.apiId === card.playerApiId);
      if (player) {
        const entry = getOrCreateStatEntry(statsArr, player, card.team);
        if (card.type === 'yellow') entry.yellowCards++;
        else entry.redCards++;
      }
    });

    // Clean sheets: GK + DEF who started (in the playing XI, not full squad)
    const homeXI = sim.homeAppearances.slice(0, 11);
    const awayXI = sim.awayAppearances.slice(0, 11);
    if (sim.homeScore === 0) {
      awayXI
        .filter((p) => p.positionGroup === 'GK' || p.positionGroup === 'DEF')
        .forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.awayTeam).cleanSheets++; });
    }
    if (sim.awayScore === 0) {
      homeXI
        .filter((p) => p.positionGroup === 'GK' || p.positionGroup === 'DEF')
        .forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.homeTeam).cleanSheets++; });
    }

    matchResults.push({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeScore: sim.homeScore,
      awayScore: sim.awayScore,
      goals: sim.result.goals,
      substitutions: sim.result.substitutions,
    });
  }

  session.currentGameweek = nextGW;

  if (nextGW === 19) {
    session.phase = 'january_transfer';
  } else if (nextGW === 38) {
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
  const userFullSquad = getUserFullSquad(session);
  const userFormation = (session as any).formation || '4-4-2';

  for (let gw = startGW; gw <= endGW; gw++) {
    const gwFixtures = session.fixtures.filter((f) => f.gameweek === gw && !f.result);

    for (const fixture of gwFixtures) {
      const isUserHome = fixture.homeTeam === session.userTeam;
      const isUserAway = fixture.awayTeam === session.userTeam;

      const homePlayers = isUserHome ? userMatchPlayers : await getAISquad(fixture.homeTeam, session);
      const awayPlayers = isUserAway ? userMatchPlayers : await getAISquad(fixture.awayTeam, session);
      const homeFullSquad = isUserHome ? userFullSquad : homePlayers;
      const awayFullSquad = isUserAway ? userFullSquad : awayPlayers;

      const sim = simulateMatch(
        fixture.homeTeam, fixture.awayTeam,
        homeFullSquad, awayFullSquad,
        isUserHome ? userFormation : '4-4-2',
        isUserAway ? userFormation : '4-4-2'
      );
      fixture.result = sim.result;

      applyResult(
        session.standings as StandingEntry[],
        fixture.homeTeam,
        fixture.awayTeam,
        sim.homeScore,
        sim.awayScore
      );

      const statsArr = session.playerSeasonStats as PlayerSeasonStats[];

      sim.homeAppearances.forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.homeTeam).appearances++; });
      sim.awayAppearances.forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.awayTeam).appearances++; });

      sim.result.goals.forEach((goal) => {
        const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
        const scorer = allAppearances.find((p) => p.apiId === goal.scorerApiId);
        if (scorer) getOrCreateStatEntry(statsArr, scorer, goal.team).goals++;
        if (goal.assisterApiId) {
          const assister = allAppearances.find((p) => p.apiId === goal.assisterApiId);
          if (assister) getOrCreateStatEntry(statsArr, assister, goal.team).assists++;
        }
      });

      sim.result.cards.forEach((card) => {
        const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
        const p = allAppearances.find((pl) => pl.apiId === card.playerApiId);
        if (p) {
          const entry = getOrCreateStatEntry(statsArr, p, card.team);
          if (card.type === 'yellow') entry.yellowCards++;
          else entry.redCards++;
        }
      });

      const homeXI = sim.homeAppearances.slice(0, 11);
      const awayXI = sim.awayAppearances.slice(0, 11);
      if (sim.homeScore === 0) {
        awayXI
          .filter((p) => p.positionGroup === 'GK' || p.positionGroup === 'DEF')
          .forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.awayTeam).cleanSheets++; });
      }
      if (sim.awayScore === 0) {
        homeXI
          .filter((p) => p.positionGroup === 'GK' || p.positionGroup === 'DEF')
          .forEach((p) => { getOrCreateStatEntry(statsArr, p, fixture.homeTeam).cleanSheets++; });
      }
    }

    session.currentGameweek = gw;

    if (gw === 19 && session.phase === 'season') {
      session.phase = 'january_transfer';
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

/** GET /api/sessions/:sessionId/teams — Returns all 20 PL teams with strength scores */
export async function getTeamsSquads(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .populate('squad')
    .select('userTeam userTeamApiId aiSquads squad formation phase');

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  const plClubs = await Club.find({ isPL: true }).lean();

  const teams = await Promise.all(
    plClubs.map(async (club) => {
      const isUserClub = club.name === session.userTeam;

      let squad: IPlayer[];
      if (isUserClub) {
        squad = session.squad as unknown as IPlayer[];
      } else {
        squad = await getAISquad(club.name, session);
      }

      const formation = isUserClub ? ((session as any).formation || '4-4-2') : '4-4-2';
      const strengthScore = calculateTeamStrengthScore(squad, formation);
      const bestXI = selectBestXI(squad, formation).map((p) => ({
        name: p.shortName,
        shortName: p.shortName,
        position: p.position,
        positionGroup: p.positionGroup,
        overall: p.stats.overall,
        photoUrl: p.photoUrl,
      }));

      return {
        clubName: club.name,
        clubApiId: club.apiId,
        logoUrl: (club as any).logoUrl ?? '',
        isUserClub,
        promoted: (club as any).promoted ?? false,
        strengthScore,
        bestXI,
        squadSize: squad.length,
      };
    })
  );

  // Sort: user club first, then by overall descending
  teams.sort((a, b) => {
    if (a.isUserClub) return -1;
    if (b.isUserClub) return 1;
    return b.strengthScore.overall - a.strengthScore.overall;
  });

  res.json({ teams, userTeam: session.userTeam, phase: session.phase });
}
