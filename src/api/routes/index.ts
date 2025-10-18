import { Router } from "express";
import userRoutes from './users.route.js';
import computerRoutes from './computers.route.js';
import taskRouter from './tasks.route.js';
import backupJobRoutes from './backup_jobs.route.js';

const router = Router();

router.use('/users', userRoutes);
router.use('/computers', computerRoutes);
router.use('/tasks', taskRouter);
router.use('/jobs', backupJobRoutes);

export default router;