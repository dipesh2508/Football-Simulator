import { Router } from 'express';
import { getTransferMarket, getPlayerById } from '@/controllers/player.controller';

const router = Router();

router.get('/market', getTransferMarket);
router.get('/:id', getPlayerById);

export default router;
