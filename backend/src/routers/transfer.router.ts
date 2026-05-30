import { Router } from 'express';
import { buyPlayer, sellPlayer, confirmTransferWindow } from '@/controllers/transfer.controller';

const router = Router();

router.post('/:sessionId/buy', buyPlayer);
router.post('/:sessionId/sell', sellPlayer);
router.post('/:sessionId/transfers/confirm', confirmTransferWindow);

export default router;
