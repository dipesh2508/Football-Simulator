import { Router } from 'express';
import { getLineup, saveLineup } from '@/controllers/lineup.controller';

const lineupRouter = Router({ mergeParams: true });

lineupRouter.get('/', getLineup);
lineupRouter.put('/', saveLineup);

export default lineupRouter;
