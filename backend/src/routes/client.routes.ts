import { Router } from 'express';

import { getMyWorkflowRuns, getMyWorkflows } from '../controllers/client.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.get('/me/workflows', authenticate('client'), getMyWorkflows);
router.get('/me/workflows/:workflowId/runs', authenticate('client'), getMyWorkflowRuns);

export default router;

