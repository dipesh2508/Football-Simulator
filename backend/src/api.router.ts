import { Router } from 'express';
import sessionRouter from '@/routers/session.router';
import playerRouter from '@/routers/player.router';
import transferRouter from '@/routers/transfer.router';
import seasonRouter from '@/routers/season.router';
import clubRouter from '@/routers/club.router';
import lineupRouter from '@/routers/lineup.router';

const apiRouter = Router();

apiRouter.use('/clubs', clubRouter);
apiRouter.use('/sessions', sessionRouter);
apiRouter.use('/players', playerRouter);
apiRouter.use('/sessions', transferRouter);
apiRouter.use('/sessions', seasonRouter);
apiRouter.use('/sessions/:sessionId/lineup', lineupRouter);

export default apiRouter;
