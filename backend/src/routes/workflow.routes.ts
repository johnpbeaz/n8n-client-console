import { Router } from 'express';

import { triggerWorkflow } from '../controllers/workflow.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.post('/:workflowId/run', authenticate(['client', 'admin']), triggerWorkflow);

export default router;

