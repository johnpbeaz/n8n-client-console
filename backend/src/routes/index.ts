import { Router } from 'express';

import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import clientRoutes from './client.routes';
import workflowRoutes from './workflow.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/workflows', workflowRoutes);
router.use('/admin', adminRoutes);

export default router;

