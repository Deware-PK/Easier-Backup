import { Router } from 'express';
import { protect, adminOnly } from '../../middlewares/auth.middleware.js';
import { getAuditLogs, getStats } from '../controllers/admin.controller.js';

const router = Router();

router.get('/audit-logs', protect, adminOnly, getAuditLogs);
router.get('/stats', protect, adminOnly, getStats);

export default router;