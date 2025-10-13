import { Router } from "express";
import userRoutes from './users.route.js';
import computerRoutes from './computers.route.js';
import taskRouter from './task.route.js';

const router = Router();

router.use('/users', userRoutes);
router.use('/computers', computerRoutes);
router.use('/tasks', taskRouter);

export default router;