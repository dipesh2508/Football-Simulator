import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { GameSession } from '@/models/gameSession.model';
import { Player, IPlayer } from '@/models/player.model';
import { Club } from '@/models/club.model';
import { simulateMatch, selectBestXI, selectBestXIWithSlots, detectBestFormation, calculateTeamStrengthScore } from '@/utils/matchSimulation.util';
import { StandingEntry, PlayerSeasonStats, PositionGroup, Fixture, MatchAppearance } from '@/types/game.types';

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
  let entry = statsArr.find((s) => s.playerApiId === player.apiId && s.club === club);
  if (!entry) {
    entry = {
      playerId: (player._id as Types.ObjectId).toString(),
      playerApiId: player.apiId,
      playerName: player.shortName,
      club,
      clubApiId: player.clubApiId,
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

function cloneBlankStat(player: IPlayer): PlayerSeasonStats {
  return {
    playerId: (player._id as Types.ObjectId).toString(),
    playerApiId: player.apiId,
    playerName: player.shortName,
    club: player.club,
    clubApiId: player.clubApiId,
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function createStatFromAppearance(appearance: MatchAppearance): PlayerSeasonStats | null {
  if (typeof appearance.playerApiId !== 'number' || Number.isNaN(appearance.playerApiId)) {
    return null;
  }

  return {
    playerId: appearance.playerApiId.toString(),
    playerApiId: appearance.playerApiId,
    playerName: appearance.playerName,
    club: appearance.club,
    clubApiId: undefined,
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function rebuildSeasonStatsFromFixtures(fixtures: Fixture[]): PlayerSeasonStats[] {
  const statsArr: PlayerSeasonStats[] = [];

  const increment = (appearance: MatchAppearance, club: string): PlayerSeasonStats => {
    if (typeof appearance.playerApiId !== 'number' || Number.isNaN(appearance.playerApiId)) {
      return {
        playerId: '',
        playerApiId: -1,
        playerName: appearance.playerName ?? 'Unknown',
        club,
        clubApiId: undefined,
        appearances: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        yellowCards: 0,
        redCards: 0,
      };
    }

    let entry = statsArr.find((s) => s.playerApiId === appearance.playerApiId && s.club === club);
    if (!entry) {
      const created = createStatFromAppearance({ ...appearance, club });
      if (!created) {
        return {
          playerId: '',
          playerApiId: -1,
          playerName: appearance.playerName ?? 'Unknown',
          club,
          clubApiId: undefined,
          appearances: 0,
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          yellowCards: 0,
          redCards: 0,
        };
      }

      entry = created;
      statsArr.push(entry);
    }
    return entry;
  };

  for (const fixture of fixtures) {
    const result = fixture.result;
    if (!result) continue;

    const homeAppearances = result.homeAppearances ?? [];
    const awayAppearances = result.awayAppearances ?? [];
    const allAppearances = [...homeAppearances, ...awayAppearances];

    homeAppearances.forEach((appearance) => {
      increment(appearance, fixture.homeTeam).appearances++;
    });
    awayAppearances.forEach((appearance) => {
      increment(appearance, fixture.awayTeam).appearances++;
    });

    result.goals.forEach((goal) => {
      const scorer = allAppearances.find((appearance) => appearance.playerApiId === goal.scorerApiId);
      if (scorer) increment(scorer, goal.team).goals++;

      if (goal.assisterApiId) {
        const assister = allAppearances.find((appearance) => appearance.playerApiId === goal.assisterApiId);
        if (assister) increment(assister, goal.team).assists++;
      }
    });

    result.cards.forEach((card) => {
      const player = allAppearances.find((appearance) => appearance.playerApiId === card.playerApiId);
      if (!player) return;

      const entry = increment(player, card.team);
      if (card.type === 'yellow') entry.yellowCards++;
      else entry.redCards++;
    });

    const homeXI = homeAppearances.slice(0, 11);
    const awayXI = awayAppearances.slice(0, 11);
    if (result.homeScore === 0) {
      awayXI
        .filter((appearance) => appearance.positionGroup === 'GK' || appearance.positionGroup === 'DEF')
        .forEach((appearance) => {
          increment(appearance, fixture.awayTeam).cleanSheets++;
        });
    }
    if (result.awayScore === 0) {
      homeXI
        .filter((appearance) => appearance.positionGroup === 'GK' || appearance.positionGroup === 'DEF')
        .forEach((appearance) => {
          increment(appearance, fixture.homeTeam).cleanSheets++;
        });
    }
  }

  return statsArr;
}

function hasCompleteAppearanceHistory(fixtures: Fixture[]): boolean {
  return fixtures
    .filter((fixture) => Boolean(fixture.result))
    .every((fixture) => {
      const result = fixture.result;
      return Boolean(result?.homeAppearances?.length) && Boolean(result?.awayAppearances?.length);
    });
}

function aggregatePlayerTotals(stats: PlayerSeasonStats[]): PlayerSeasonStats[] {
  const totals = new Map<number, PlayerSeasonStats>();

  for (const stat of stats) {
    const existing = totals.get(stat.playerApiId);
    if (!existing) {
      totals.set(stat.playerApiId, { ...stat });
      continue;
    }

    const shouldReplaceIdentity = stat.appearances >= existing.appearances;
    existing.appearances += stat.appearances;
    existing.goals += stat.goals;
    existing.assists += stat.assists;
    existing.cleanSheets += stat.cleanSheets;
    existing.yellowCards += stat.yellowCards;
    existing.redCards += stat.redCards;

    if (shouldReplaceIdentity) {
      existing.playerId = stat.playerId;
      existing.playerName = stat.playerName;
      existing.club = stat.club;
      existing.clubApiId = stat.clubApiId;
    }
  }

  return [...totals.values()].sort(
    (a, b) => b.appearances - a.appearances || b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName)
  );
}

function groupStatsByClub(stats: PlayerSeasonStats[]): { club: string; players: PlayerSeasonStats[] }[] {
  const clubMap = new Map<string, PlayerSeasonStats[]>();

  for (const stat of stats) {
    const clubStats = clubMap.get(stat.club) ?? [];
    clubStats.push(stat);
    clubMap.set(stat.club, clubStats);
  }

  return [...clubMap.entries()]
    .map(([club, players]) => ({
      club,
      players: players.sort(
        (a, b) => b.appearances - a.appearances || b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName)
      ),
    }))
    .sort((a, b) => a.club.localeCompare(b.club));
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

  if (xi && xi.length > 0) {
    const xiPlayers = xi
      .map((slot) => slot.playerId)
      .filter((p): p is IPlayer => p && typeof p === 'object' && 'stats' in p);

    if (xiPlayers.length === 11) return xiPlayers;

    // Partial lineup (e.g. GK not set): fill missing slots from squad by positionGroup
    if (xiPlayers.length >= 7) {
      const filledIds = new Set(xiPlayers.map((p) => String((p as any)._id)));
      const available = squad.filter((p) => !filledIds.has(String((p as any)._id)));
      const result: IPlayer[] = [...xiPlayers];

      const emptySlots = xi.filter(
        (slot) => !(slot.playerId && typeof slot.playerId === 'object' && 'stats' in slot.playerId)
      );

      for (const slot of emptySlots) {
        const group = slot.positionGroup as PositionGroup;
        // Prefer exact positionGroup match, then any available player
        const best =
          available.filter((p) => p.positionGroup === group).sort((a, b) => b.stats.overall - a.stats.overall)[0] ??
          available.sort((a, b) => b.stats.overall - a.stats.overall)[0];
        if (best) {
          result.push(best);
          available.splice(available.indexOf(best), 1);
        }
      }

      if (result.length === 11) return result;
    }
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
    // Bench pool: for user team use the full squad; for AI the squad IS the bench already
    const homeFullSquad = isUserHome ? userFullSquad : undefined;
    const awayFullSquad = isUserAway ? userFullSquad : undefined;
    // Formation: user picks theirs; AI uses whatever suits their squad best
    const homeFormation = isUserHome ? userFormation : detectBestFormation(homePlayers);
    const awayFormation = isUserAway ? userFormation : detectBestFormation(awayPlayers);

    const sim = simulateMatch(
      fixture.homeTeam, fixture.awayTeam,
      homePlayers, awayPlayers,
      homeFormation,
      awayFormation,
      homeFullSquad,
      awayFullSquad
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
      // Bench pool: for user team use the full squad; for AI the squad IS the bench already
      const homeFullSquad = isUserHome ? userFullSquad : undefined;
      const awayFullSquad = isUserAway ? userFullSquad : undefined;
      // Formation: user picks theirs; AI uses whatever suits their squad best
      const homeFormation = isUserHome ? userFormation : detectBestFormation(homePlayers);
      const awayFormation = isUserAway ? userFormation : detectBestFormation(awayPlayers);

      const sim = simulateMatch(
        fixture.homeTeam, fixture.awayTeam,
        homePlayers, awayPlayers,
        homeFormation,
        awayFormation,
        homeFullSquad,
        awayFullSquad
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
    .select('playerSeasonStats userTeam currentGameweek squad userTeamApiId')
    .populate('squad')
    .lean();

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  const stats = session.playerSeasonStats as PlayerSeasonStats[];
  const playerTotals = aggregatePlayerTotals(stats);
  const statsByPlayerApiId = new Map<number, PlayerSeasonStats>();

  for (const stat of playerTotals) {
    statsByPlayerApiId.set(stat.playerApiId, stat);
  }

  const squadPlayers = (session.squad as unknown as IPlayer[]) ?? [];
  for (const player of squadPlayers) {
    if (!statsByPlayerApiId.has(player.apiId)) {
      const blankStat = cloneBlankStat(player);
      statsByPlayerApiId.set(player.apiId, blankStat);
      playerTotals.push(blankStat);
    }
  }

  const topScorers = [...playerTotals].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances).slice(0, 10);
  const topAssists = [...playerTotals].sort((a, b) => b.assists - a.assists || b.appearances - a.appearances).slice(0, 10);
  const topCleanSheets = [...playerTotals]
    .filter((s) => s.cleanSheets > 0)
    .sort((a, b) => b.cleanSheets - a.cleanSheets)
    .slice(0, 5);

  const allPlayers = await Player.find({ league: 'Premier League' })
    .select('_id apiId shortName club clubApiId')
    .lean();
  const plClubNames = new Set(allPlayers.map((player) => player.club));
  plClubNames.add(session.userTeam ?? '');

  const squadPlayerIds = new Set(squadPlayers.map((player) => player.apiId));
  const visiblePlayerStats: PlayerSeasonStats[] = [];

  for (const stat of playerTotals) {
    if (plClubNames.has(stat.club) && !squadPlayerIds.has(stat.playerApiId)) {
      visiblePlayerStats.push(stat);
    }
  }

  for (const player of squadPlayers) {
    const seeded = statsByPlayerApiId.get(player.apiId) ?? cloneBlankStat(player);
    visiblePlayerStats.push({
      ...seeded,
      club: session.userTeam,
      clubApiId: session.userTeamApiId ?? seeded.clubApiId,
    });
  }

  const clubStats = groupStatsByClub(visiblePlayerStats).filter((entry) => plClubNames.has(entry.club));

  const visibleTotals = visiblePlayerStats.filter((stat) => plClubNames.has(stat.club) || squadPlayerIds.has(stat.playerApiId));

  res.json({
    topScorers: [...visibleTotals].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances).slice(0, 10),
    topAssists: [...visibleTotals].sort((a, b) => b.assists - a.assists || b.appearances - a.appearances).slice(0, 10),
    topCleanSheets: [...visibleTotals]
      .filter((s) => s.cleanSheets > 0)
      .sort((a, b) => b.cleanSheets - a.cleanSheets)
      .slice(0, 5),
    playerStats: visibleTotals,
    clubStats,
    userTeam: session.userTeam,
    currentGameweek: session.currentGameweek,
  });
}

/** GET /api/sessions/:sessionId/teams — Returns all 20 PL teams with strength scores */
export async function getTeamsSquads(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .populate('squad')
    .populate('startingXI.playerId')
    .select('userTeam userTeamApiId aiSquads squad formation startingXI phase');

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

      const formation = isUserClub ? ((session as any).formation || '4-4-2') : detectBestFormation(squad);

      // For user team: compute strength from saved XI if available; else from full squad
      let xiPlayers: IPlayer[] | null = null;
      if (isUserClub) {
        const xi = (session as any).startingXI as { slotId: string; label: string; positionGroup: string; playerId: any }[];
        if (xi && xi.length > 0) {
          const filled = xi.filter((s) => s.playerId && typeof s.playerId === 'object' && 'stats' in s.playerId);
          if (filled.length === 11) {
            xiPlayers = filled.map((s) => s.playerId as IPlayer);
          }
        }
      }

      const strengthScore = calculateTeamStrengthScore(xiPlayers ?? squad, formation);

      // Build the lineup list — for user team show saved lineup with slot labels,
      // for AI teams show best XI with real formation slot labels
      let lineupPlayers: { name: string; position: string; positionGroup: string; overall: number; slotLabel: string; photoUrl?: string }[];

      if (isUserClub && xiPlayers) {
        const xi = (session as any).startingXI as { slotId: string; label: string; positionGroup: string; playerId: any }[];
        lineupPlayers = xi
          .filter((s) => s.playerId && typeof s.playerId === 'object' && 'stats' in s.playerId)
          .map((s) => ({
            name: (s.playerId as IPlayer).shortName,
            position: (s.playerId as IPlayer).position,
            positionGroup: (s.playerId as IPlayer).positionGroup,
            overall: (s.playerId as IPlayer).stats.overall,
            slotLabel: s.label,
            photoUrl: (s.playerId as IPlayer).photoUrl,
          }));
      } else {
        // Use selectBestXIWithSlots so each player gets their actual formation slot label
        lineupPlayers = selectBestXIWithSlots(squad, formation).map(({ player: p, slotLabel }) => ({
          name: p.shortName,
          position: p.position,
          positionGroup: p.positionGroup,
          overall: p.stats.overall,
          slotLabel,
          photoUrl: p.photoUrl,
        }));
      }

      return {
        clubName: club.name,
        clubApiId: club.apiId,
        logoUrl: (club as any).logoUrl ?? '',
        isUserClub,
        promoted: (club as any).promoted ?? false,
        strengthScore,
        formation,
        lineupSaved: isUserClub && !!xiPlayers,
        bestXI: lineupPlayers,
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
