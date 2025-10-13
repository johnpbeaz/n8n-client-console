import { Router } from 'express';

import {
  archiveClient,
  createClient,
  deleteClient,
  listClientWorkflows,
  listClients,
  listN8nProjects,
  listN8nWorkflows,
  syncClientWorkflows,
  unarchiveClient,
  updateClientWorkflows,
  resetClientPassword,
  updateWorkflow,
  updateClientEmails,
} from '../controllers/admin.controller';
import { getN8nSettings, updateN8nSettings } from '../controllers/settings.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate('admin'));

router.get('/clients', listClients);
router.post('/clients', createClient);
router.get('/clients/:clientId/workflows', listClientWorkflows);
router.post('/clients/:clientId/sync', syncClientWorkflows);
router.put('/clients/:clientId/workflows', updateClientWorkflows);
router.put('/clients/:clientId/emails', updateClientEmails);
router.post('/clients/:clientId/reset-password', resetClientPassword);
router.post('/clients/:clientId/archive', archiveClient);
router.post('/clients/:clientId/unarchive', unarchiveClient);
router.delete('/clients/:clientId', deleteClient);
router.patch('/workflows/:workflowId', updateWorkflow);
router.get('/n8n/projects', listN8nProjects);
router.get('/n8n/workflows', listN8nWorkflows);
router.get('/n8n/config', getN8nSettings);
router.put('/n8n/config', updateN8nSettings);

export default router;
