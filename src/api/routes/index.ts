import { Router } from "express";
import userRoutes from './users.route.js';
import computerRoutes from './computers.route.js';
import taskRouter from './tasks.route.js';
import backupJobRoutes from './backup_jobs.route.js';
import adminRoutes from './admin.route.js';
import authRoutes from './auth.route.js';
import agentAuthRoutes from './agentAuth.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/agent-auth', agentAuthRoutes);
router.use('/users', userRoutes);
router.use('/computers', computerRoutes);
router.use('/tasks', taskRouter);
router.use('/jobs', backupJobRoutes);
router.use('/admin', adminRoutes);

export default router;