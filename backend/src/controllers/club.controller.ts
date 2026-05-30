import { Request, Response } from 'express';
import { Club } from '@/models/club.model';

export async function getClubs(_req: Request, res: Response): Promise<void> {
  const clubs = await Club.find({ isPL: true })
    .select('name shortName reputation lastSeasonFinish budgetRange promoted')
    .sort({ lastSeasonFinish: 1 })
    .lean();

  res.json({ clubs });
}
