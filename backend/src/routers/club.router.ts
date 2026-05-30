import { Router } from 'express';
import { getClubs } from '@/controllers/club.controller';

const router = Router();

router.get('/', getClubs);

export default router;
