import { type Response } from 'express';
import { type AuthRequest } from '../../middlewares/auth.middleware.js';
import prisma from '../../db.js';

/**
 * @description Get backup jobs for a specific task belonging to the logged-in user
 * @route GET /api/v1/jobs/task/:taskId
 */
export const getJobsForTask = async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.sub;

    try {
        const task = await prisma.tasks.findFirst({
            where: { id: BigInt(taskId), computer: { user_id: BigInt(userId!) } }
        });

        if (!task) {
            return res.status(403).json({ message: "You don't have permission to view these jobs." });
        }

        const jobs = await prisma.backup_jobs.findMany({
            where: { task_id: BigInt(taskId) },
            orderBy: { started_at: 'desc' },
            take: 50
        });

        const formattedJobs = jobs.map(job => ({
            ...job,
            id: job.id.toString(),
            task_id: job.task_id.toString()
        }));

        res.status(200).json(formattedJobs);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
}