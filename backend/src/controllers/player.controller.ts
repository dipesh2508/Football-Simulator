import { Request, Response } from 'express';
import { Player } from '@/models/player.model';
import { Club } from '@/models/club.model';
import { GameSession } from '@/models/gameSession.model';
import { calculateLikelihood } from '@/utils/likelihood.util';
import { Types } from 'mongoose';

/** GET /api/players/market?sessionId=&page=&limit=&position=&league=&maxValue= */
export async function getTransferMarket(req: Request, res: Response): Promise<void> {
  const {
    sessionId,
    page = '1',
    limit = '20',
    position,
    league,
    maxValue,
    search,
  } = req.query as Record<string, string>;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId query param is required' });
    return;
  }

  const session = await GameSession.findOne({ sessionId }).select('squad userTeam').lean();
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  // Build filter: exclude players already in ANY squad in this session
  const filter: Record<string, any> = {
    _id: { $nin: session.squad as Types.ObjectId[] },
  };
  if (position) filter.positionGroup = position;
  if (league) filter.league = league;
  if (maxValue) filter.marketValue = { $lte: parseFloat(maxValue) };
  if (search) filter.name = { $regex: search, $options: 'i' };

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [players, total] = await Promise.all([
    Player.find(filter).sort({ 'stats.overall': -1 }).skip(skip).limit(limitNum).lean(),
    Player.countDocuments(filter),
  ]);

  // Attach likelihood for each player relative to the user's team
  const [userClub, allClubs] = await Promise.all([
    Club.findOne({ name: session.userTeam }).lean(),
    Club.find({}).lean(),
  ]);

  const playersWithLikelihood = players.map((p) => {
    let likelihood = null;
    if (userClub) {
      likelihood = calculateLikelihood(p as any, userClub as any, allClubs as any[]);
    }
    return { ...p, likelihood };
  });

  res.json({
    players: playersWithLikelihood,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}

/** GET /api/players/:id — Single player details */
export async function getPlayerById(req: Request, res: Response): Promise<void> {
  const player = await Player.findById(req.params.id).lean();
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }
  res.json(player);
}
