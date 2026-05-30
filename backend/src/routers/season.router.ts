import { Router } from 'express';
import {
  simulateGameweek,
  simulateAll,
  getStandings,
  getSeasonStats,
  getTeamsSquads,
} from '@/controllers/season.controller';

const router = Router();

router.post('/:sessionId/simulate', simulateGameweek);
router.post('/:sessionId/simulate-all', simulateAll);
router.get('/:sessionId/standings', getStandings);
router.get('/:sessionId/stats', getSeasonStats);
router.get('/:sessionId/teams', getTeamsSquads);

export default router;
