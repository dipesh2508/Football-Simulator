import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { GameSession } from '@/models/gameSession.model';
import { Club } from '@/models/club.model';
import { Player } from '@/models/player.model';
import { calculateLikelihood, rollTransferDice } from '@/utils/likelihood.util';
import { runAITransfers } from '@/utils/aiTransfer.util';

/** POST /api/sessions/:sessionId/buy */
export async function buyPlayer(req: Request, res: Response): Promise<void> {
  const { playerId } = req.body as { playerId: string };

  if (!playerId) {
    res.status(400).json({ error: 'playerId is required' });
    return;
  }

  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  if (session.phase !== 'summer_transfer' && session.phase !== 'january_transfer') {
    res.status(409).json({ error: 'Transfer window is not open' });
    return;
  }

  const player = await Player.findById(playerId);
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  // Check player is not already in this session's squad
  const alreadyOwned = (session.squad as Types.ObjectId[]).some((id) => id.equals(playerId));
  if (alreadyOwned) {
    res.status(409).json({ error: 'Player is already in your squad' });
    return;
  }

  // Budget check
  if (player.marketValue > session.budget) {
    res.status(400).json({
      error: `Insufficient budget. Player costs £${player.marketValue}m, you have £${session.budget}m`,
    });
    return;
  }

  // Likelihood check
  const [userClub, allClubs] = await Promise.all([
    Club.findOne({ name: session.userTeam }),
    Club.find({}),
  ]);

  if (!userClub) {
    res.status(500).json({ error: 'Could not find your club data' });
    return;
  }

  const likelihood = calculateLikelihood(player, userClub, allClubs);
  const success = rollTransferDice(likelihood.score);

  if (!success) {
    res.status(200).json({
      success: false,
      message: `Deal failed — ${player.shortName} chose not to join ${session.userTeam}.`,
      likelihood,
    });
    return;
  }

  // Deduct fee and add to squad
  const window = session.phase === 'summer_transfer' ? 'summer' : 'january';
  session.budget = Math.round((session.budget - player.marketValue) * 10) / 10;
  (session.squad as Types.ObjectId[]).push(new Types.ObjectId(playerId));
  session.transfers.push({
    playerId: playerId.toString(),
    playerName: player.shortName,
    fee: player.marketValue,
    window,
    type: 'buy',
    timestamp: new Date(),
  });

  await session.save();

  res.json({
    success: true,
    message: `${player.shortName} has joined ${session.userTeam}!`,
    budget: session.budget,
    likelihood,
    player: { name: player.shortName, position: player.position, overall: player.stats.overall },
  });
}

/** POST /api/sessions/:sessionId/sell */
export async function sellPlayer(req: Request, res: Response): Promise<void> {
  const { playerId } = req.body as { playerId: string };

  if (!playerId) {
    res.status(400).json({ error: 'playerId is required' });
    return;
  }

  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  if (session.phase !== 'summer_transfer' && session.phase !== 'january_transfer') {
    res.status(409).json({ error: 'Transfer window is not open' });
    return;
  }

  const squadIds = session.squad as Types.ObjectId[];
  const idx = squadIds.findIndex((id) => id.equals(playerId));

  if (idx === -1) {
    res.status(400).json({ error: 'Player is not in your squad' });
    return;
  }

  const player = await Player.findById(playerId);
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  // Sell at 80% of market value
  const sellFee = Math.round(player.marketValue * 0.8 * 10) / 10;
  const window = session.phase === 'summer_transfer' ? 'summer' : 'january';

  squadIds.splice(idx, 1);
  session.budget = Math.round((session.budget + sellFee) * 10) / 10;
  session.transfers.push({
    playerId: playerId.toString(),
    playerName: player.shortName,
    fee: sellFee,
    window,
    type: 'sell',
    timestamp: new Date(),
  });

  await session.save();

  res.json({
    success: true,
    message: `${player.shortName} sold for £${sellFee}m`,
    budget: session.budget,
  });
}

/** POST /api/sessions/:sessionId/transfers/confirm — Close window, run AI transfers */
export async function confirmTransferWindow(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  if (session.phase !== 'summer_transfer' && session.phase !== 'january_transfer') {
    res.status(409).json({ error: 'Transfer window is not currently open' });
    return;
  }

  // Run AI transfers for all other PL clubs
  const [plClubs, allClubs, allPlayers] = await Promise.all([
    Club.find({ isPL: true }),
    Club.find({}),
    Player.find({ _id: { $nin: session.squad as Types.ObjectId[] } }),
  ]);

  const { summaries, clubBought } = await runAITransfers(session, plClubs, allClubs, allPlayers);

  // Build session-aware AI squads: original top-20 DB squad + transfer purchases
  // Players that are already claimed (user's squad + every AI purchase) must not appear
  // in another club's original squad — this prevents the same player showing up in
  // multiple teams.
  const allBoughtPlayerIds = new Set<string>();
  for (const ids of clubBought.values()) {
    ids.forEach((id) => allBoughtPlayerIds.add(id.toString()));
  }
  const claimedIds: Types.ObjectId[] = [
    ...(session.squad as Types.ObjectId[]),
    ...[...allBoughtPlayerIds].map((id) => new Types.ObjectId(id)),
  ];

  const userTeam = session.userTeam;
  for (const club of plClubs) {
    if (club.name === userTeam) continue;

    const boughtIds = clubBought.get(club.name) ?? [];

    // Fetch the club's original top-20 DB squad, excluding all claimed players.
    // boughtIds are excluded here too (globally claimed), but added back below — so
    // a club's own purchase is never double-counted.
    const originalSquad = await Player.find({
      club: club.name,
      _id: { $nin: claimedIds },
    })
      .sort({ 'stats.overall': -1 })
      .limit(20)
      .select('_id');

    const originalIds = originalSquad.map((p) => p._id as Types.ObjectId);
    const allIds = [...originalIds, ...boughtIds];

    (session.aiSquads as Map<string, Types.ObjectId[]>).set(club.name, allIds);
  }

  session.markModified('aiSquads');

  // Advance phase — both windows lead back into the season
  session.phase = 'season';
  await session.save();

  res.json({
    message: 'Transfer window closed',
    nextPhase: session.phase,
    aiActivity: summaries.map((s) => ({
      club: s.club,
      signings: s.bought.length,
      topSignings: s.bought.slice(0, 3),
    })),
  });
}
