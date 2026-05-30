import { Router } from 'express';
import { createSession, getSession, selectTeam } from '@/controllers/session.controller';

const router = Router();

router.post('/', createSession);
router.get('/:sessionId', getSession);
router.post('/:sessionId/team', selectTeam);

export default router;
