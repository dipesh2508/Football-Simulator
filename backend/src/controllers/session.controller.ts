import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GameSession } from '@/models/gameSession.model';
import { Club } from '@/models/club.model';
import { Player } from '@/models/player.model';
import { generateFixtures } from '@/utils/fixtures.util';
import { StandingEntry } from '@/types/game.types';

const SESSION_TTL_DAYS = 7;

/** POST /api/sessions — Create a fresh session */
export async function createSession(req: Request, res: Response): Promise<void> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await GameSession.create({ sessionId, expiresAt });
  res.status(201).json({ sessionId: session.sessionId });
}

/** GET /api/sessions/:sessionId — Get full session state */
export async function getSession(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .populate('squad')
    .lean();

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  res.json(session);
}

/** POST /api/sessions/:sessionId/team — Select PL team, assign budget, set up fixtures */
export async function selectTeam(req: Request, res: Response): Promise<void> {
  const { teamName } = req.body as { teamName: string };

  if (!teamName) {
    res.status(400).json({ error: 'teamName is required' });
    return;
  }

  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }
  if (session.phase !== 'team_selection') {
    res.status(409).json({ error: 'Team has already been selected for this session' });
    return;
  }

  // Find the selected PL club
  const club = await Club.findOne({ name: teamName, isPL: true });
  if (!club) {
    res.status(404).json({ error: `PL club "${teamName}" not found` });
    return;
  }

  // Assign random budget from the club's range
  const [budgetMin, budgetMax] = club.budgetRange ?? [20, 50];
  const budget = Math.round(budgetMin + Math.random() * (budgetMax - budgetMin));

  // Assign initial squad: top players from this club in DB
  const initialSquad = await Player.find({ club: teamName })
    .sort({ 'stats.overall': -1 })
    .limit(25)
    .select('_id');

  // Generate fixtures for all 20 PL teams
  const plClubs = await Club.find({ isPL: true }).select('name apiId').lean();
  const teamNames = plClubs.map((c) => c.name);
  const fixtures = generateFixtures(teamNames);

  // Build initial standings (all zeros)
  const standings: StandingEntry[] = plClubs.map((c) => ({
    team: c.name,
    teamApiId: c.apiId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  }));

  session.userTeam = club.name;
  session.userTeamApiId = club.apiId;
  session.budget = budget;
  session.squad = initialSquad.map((p) => p._id);
  session.fixtures = fixtures;
  session.standings = standings;
  session.phase = 'summer_transfer';
  await session.save();

  res.json({
    userTeam: session.userTeam,
    budget: session.budget,
    squadCount: session.squad.length,
    phase: session.phase,
  });
}
