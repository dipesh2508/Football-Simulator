import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { GameSession } from '@/models/gameSession.model';
import { Player } from '@/models/player.model';
import { FORMATIONS, FormationName } from '@/types/game.types';

const VALID_FORMATIONS = Object.keys(FORMATIONS) as FormationName[];

/** GET /api/sessions/:sessionId/lineup */
export async function getLineup(req: Request, res: Response): Promise<void> {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId })
    .populate('startingXI.playerId')
    .select('formation startingXI userTeam phase');

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  const formation = (session.formation as FormationName) || '4-4-2';
  const slotDefs = FORMATIONS[formation] ?? FORMATIONS['4-4-2'];

  // Merge persisted assignments with the slot definitions
  const startingXI = slotDefs.map((def) => {
    const saved = (session.startingXI as any[]).find((s) => s.slotId === def.slotId);
    return {
      slotId: def.slotId,
      label: def.label,
      positionGroup: def.positionGroup,
      player: saved?.playerId && typeof saved.playerId === 'object' ? saved.playerId : null,
    };
  });

  res.json({ formation, startingXI });
}

/** PUT /api/sessions/:sessionId/lineup */
export async function saveLineup(req: Request, res: Response): Promise<void> {
  const { formation, slots } = req.body as {
    formation: FormationName;
    slots: { slotId: string; playerId: string | null }[];
  };

  // Validate formation
  if (!formation || !VALID_FORMATIONS.includes(formation)) {
    res.status(400).json({ error: `Invalid formation. Must be one of: ${VALID_FORMATIONS.join(', ')}` });
    return;
  }

  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate('squad');
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  const squadIds = new Set(
    (session.squad as any[]).map((p) => String(p._id ?? p))
  );

  const slotDefs = FORMATIONS[formation];
  if (!slots || !Array.isArray(slots)) {
    res.status(400).json({ error: 'slots must be an array' });
    return;
  }

  // Validate: no player assigned to two slots
  const assignedPlayerIds: string[] = slots
    .map((s) => s.playerId)
    .filter((id): id is string => !!id);

  const uniqueAssigned = new Set(assignedPlayerIds);
  if (uniqueAssigned.size !== assignedPlayerIds.length) {
    res.status(400).json({ error: 'A player cannot be assigned to more than one slot' });
    return;
  }

  // Validate: all assigned players are in the squad
  for (const playerId of assignedPlayerIds) {
    if (!squadIds.has(playerId)) {
      res.status(400).json({ error: `Player ${playerId} is not in your squad` });
      return;
    }
  }

  // Build the startingXI array using the formation's slot definitions
  const startingXI = slotDefs.map((def) => {
    const provided = slots.find((s) => s.slotId === def.slotId);
    return {
      slotId: def.slotId,
      label: def.label,
      positionGroup: def.positionGroup,
      playerId: provided?.playerId ? new Types.ObjectId(provided.playerId) : null,
    };
  });

  session.formation = formation;
  (session as any).startingXI = startingXI;
  session.markModified('startingXI');
  await session.save();

  res.json({ success: true, formation, slotsAssigned: assignedPlayerIds.length });
}
