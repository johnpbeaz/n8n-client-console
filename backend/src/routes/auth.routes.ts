import { Router } from 'express';

import { completePasswordSetup, login, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.post('/login', login);
router.post('/password/setup', completePasswordSetup);
router.get('/me', authenticate(), me);

export default router;
