import { type Response } from "express";
import { type AuthRequest } from '../../middlewares/auth.middleware.js';
import prisma from '../../db.js';
import { logAudit } from '../../middlewares/audit.middleware.js';
import { sanitizePath } from '../../utils/pathValidator.js';
import { sendCommandToAgent } from '../../services/websocket.service.js';

function isValidDiscordWebhook(url: string | null): boolean {
  if (!url) return true; // null is OK
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'discord.com' || parsed.hostname.endsWith('.discord.com');
  } catch {
    return false;
  }
}

/**
 * @description Create a new backup task for a specific computer
 * @route POST /api/v1/tasks
 */
export const createTask = async (req: AuthRequest, res: Response) => {
    const { computer_id, name, source_path, destination_path, schedule, 
            is_active, backup_keep_count, retry_attempts, retry_delay_seconds,
            folder_prefix, timestamp_format,
            discord_webhook_url, notification_on_success, notification_on_failure
          } = req.body;

    if (!isValidDiscordWebhook(discord_webhook_url)) {
        return res.status(400).json({ message: 'Invalid Discord webhook URL.' });
    }

    const safeSrc = sanitizePath(source_path);
    const safeDest = sanitizePath(destination_path);
    if (!safeSrc || !safeDest) {
        await logAudit(req, { 
            action: 'create_task', 
            status: 'failed', 
            details: `Unsafe path detected: src=${source_path}, dest=${destination_path}` 
        });
        return res.status(400).json({ message: 'Invalid or unsafe file paths (path traversal detected).' });
    }

    const userId = req.user?.sub;

    if (!computer_id || !name || !source_path || !destination_path || !schedule) {
        return res.status(400).json({ message: 'Please fill all fields.' });
    }

    try {
        const computer = await prisma.computers.findFirst({
            where: {
                id: BigInt(computer_id),
                user_id: BigInt(userId!),
            }
        });

        if (!computer) {
            return res.status(403).json({ message: "You don't have permission!" });
        }

        const newTask = await prisma.tasks.create({
            data: {
                computer_id: BigInt(computer_id),
                name,
                source_path: safeSrc,
                destination_path: safeDest, 
                schedule,
                is_active,
                backup_keep_count: backup_keep_count ? parseInt(backup_keep_count) : undefined,
                retry_attempts: retry_attempts ? parseInt(retry_attempts) : undefined,
                retry_delay_seconds: retry_delay_seconds ? parseInt(retry_delay_seconds) : undefined,
                folder_prefix: folder_prefix || undefined, // ใช้ default จาก schema ถ้า undefined
                timestamp_format: timestamp_format || undefined, // ใช้ default จาก schema ถ้า undefined
                discord_webhook_url: discord_webhook_url || null, // ส่ง null ถ้าไม่มี
                notification_on_success: notification_on_success || null,
                notification_on_failure: notification_on_failure || null,
            }
        });

        await logAudit(req, {
            action: 'create_task',
            resource: 'tasks',
            resourceId: newTask.id.toString(),
            status: 'success',
            details: `Task: ${name}`
        });

        res.status(201).json({
            ...newTask,
            id: newTask.id.toString(),
            computer_id: newTask.computer_id.toString(),
        });



    } catch (error) {
        await logAudit(req, { action: 'create_task', status: 'failed' });
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

/**
 * @description Trigger a task to run immediately via WebSocket
 * @route POST /api/v1/tasks/:taskId/start-now
 */
export const startTaskNow = async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.sub;

    if (!userId) {
        return res.status(401).json({ message: 'User not found' });
    }

    try {
        // 1. Fetch task and verify ownership
        const task = await prisma.tasks.findFirst({
            where: {
                id: BigInt(taskId),
                computer: {
                    user_id: BigInt(userId),
                }
            },
            include: {
                computer: true
            }
        });

        if (!task) {
            return res.status(403).json({ message: "You don't have permission or task not found!" });
        }

        // 2. Check if agent is online (computerId from task)
        const computerId = task.computer_id.toString();

        // 3. Create backup_jobs record (status: 'success')
        const newJob = await prisma.backup_jobs.create({
            data: {
                task_id: task.id,
                status: 'success',
                started_at: new Date(),
            }
        });

        const jobId = newJob.id.toString();

        // 4. Prepare command payload
        const command = {
            action: 'start-backup',
            jobId,
            taskId: task.id.toString(),
            sourceFile: task.source_path,
            destinationBaseFolder: task.destination_path,
            keepCount: task.backup_keep_count ?? 3,
            retryAttempts: task.retry_attempts ?? 3, 
            retryDelay: task.retry_delay_seconds ?? 60,
            folderPrefix: task.folder_prefix ?? undefined,
            timestampFormat: task.timestamp_format ?? undefined,
            discordWebhookUrl: task.discord_webhook_url ?? undefined,
            notificationOnSuccess: task.notification_on_success ?? undefined,
            notificationOnFailure: task.notification_on_failure ?? undefined,
        };

        // 5. Send command via WebSocket
        const sent = sendCommandToAgent(computerId, command);

        if (!sent) {
            // Agent offline - update job status
            await prisma.backup_jobs.update({
                where: { id: newJob.id },
                data: {
                    status: 'failed',
                    details: 'Agent is offline or not connected',
                    completed_at: new Date(),
                }
            });

            await logAudit(req, {
                action: 'start_task_now',
                resource: 'tasks',
                resourceId: taskId,
                status: 'failed',
                details: 'Agent offline'
            });

            return res.status(503).json({ 
                message: 'Agent is offline. Cannot start task now.',
                jobId 
            });
        }

        // 6. Success - command sent
        await logAudit(req, {
            action: 'start_task_now',
            resource: 'tasks',
            resourceId: taskId,
            status: 'success',
            details: `Job ID: ${jobId}`
        });

        res.status(200).json({
            message: 'Task started successfully',
            jobId,
            taskId: task.id.toString(),
            taskName: task.name,
        });

    } catch (error) {
        await logAudit(req, {
            action: 'start_task_now',
            resource: 'tasks',
            resourceId: taskId,
            status: 'failed'
        });
        console.error("Error starting task now:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * @description Get all tasks for a specific computer
 * @route GET /api/v1/tasks/computer/:computerId
 */
export const getTasksForComputer = async (req: AuthRequest, res: Response) => {
    const { computerId } = req.params;
    const userId = req.user?.sub;

    try {
        const computer = await prisma.computers.findFirst({
            where: {
                id: BigInt(computerId),
                user_id: BigInt(userId!),
            }
        });

        if (!computer) {
            return res.status(403).json({ message: "You don't have permission!" });
        }

        const tasks = await prisma.tasks.findMany({
            where: {
                computer_id: BigInt(computerId)
            }
        });
        
        const formattedTasks = tasks.map(task => ({
            ...task,
            id: task.id.toString(),
            computer_id: task.computer_id.toString()
        }));

        res.status(200).json(formattedTasks);

    } catch (error) {
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * @description Update an existing task
 * @route PUT /api/v1/tasks/:taskId
 */
export const updateTask = async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.sub;
    const { name, source_path, destination_path, schedule, is_active,
            backup_keep_count, retry_attempts, retry_delay_seconds,
            folder_prefix, timestamp_format,
            discord_webhook_url, notification_on_success, notification_on_failure
          } = req.body;

    if (!isValidDiscordWebhook(discord_webhook_url)) {
        return res.status(400).json({ message: 'Invalid Discord webhook URL.' });
    }
    
    const safeSrc = sanitizePath(source_path);
    const safeDest = sanitizePath(destination_path);
    if (!safeSrc || !safeDest) {
        await logAudit(req, { 
            action: 'update_task', 
            resource: 'tasks', 
            resourceId: taskId, 
            status: 'failed', 
            details: `Unsafe path detected: src=${source_path}, dest=${destination_path}` 
        });
        return res.status(400).json({ message: 'Invalid or unsafe file paths (path traversal detected).' });
    }

    try {
        const task = await prisma.tasks.findFirst({
            where: {
                id: BigInt(taskId),
                computer: {
                    user_id: BigInt(userId!),
                }
            }
        });

        if (!task) {
            return res.status(403).json({ message: "You don't have permission!" });
        }

        const updatedTask = await prisma.tasks.update({
            where: {
                id: BigInt(taskId),
            },
            data: {
                name,
                source_path: safeSrc,
                destination_path: safeDest, 
                schedule,
                is_active,
                backup_keep_count: backup_keep_count !== undefined ? (backup_keep_count === null ? null : parseInt(backup_keep_count)) : undefined,
                retry_attempts: retry_attempts !== undefined ? (retry_attempts === null ? null : parseInt(retry_attempts)) : undefined,
                retry_delay_seconds: retry_delay_seconds !== undefined ? (retry_delay_seconds === null ? null : parseInt(retry_delay_seconds)) : undefined,
                folder_prefix: folder_prefix,
                timestamp_format: timestamp_format,
                discord_webhook_url: discord_webhook_url,
                notification_on_success: notification_on_success,
                notification_on_failure: notification_on_failure,
            },
        });

        await logAudit(req, {
            action: 'update_task',
            resource: 'tasks',
            resourceId: taskId,
            status: 'success'
        });

        res.status(200).json({
            ...updatedTask,
            id: updatedTask.id.toString(),
            computer_id: updatedTask.computer_id.toString(),
        });

    } catch (error) {
        await logAudit(req, { action: 'update_task', resource: 'tasks', resourceId: taskId, status: 'failed' });
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * @description Delete a task
 * @route DELETE /api/v1/tasks/:taskId
 */
export const deleteTask = async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.sub;

    try {
        const task = await prisma.tasks.findFirst({
            where: {
                id: BigInt(taskId),
                computer: {
                    user_id: BigInt(userId!),
                }
            }
        });
        
        if (!task) {
            return res.status(403).json({ message: "You don't have permission!" });
        }

        await prisma.tasks.delete({
            where: {
                id: BigInt(taskId),
            }
        });

        await logAudit(req, {
            action: 'delete_task',
            resource: 'tasks',
            resourceId: taskId,
            status: 'success'
        });

        res.status(200).json({ message: 'Task deleted successfully!' });

    } catch (error) {
        await logAudit(req, { action: 'delete_task', resource: 'tasks', resourceId: taskId, status: 'failed' });
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * @description Get the total count of tasks for the logged-in user
 * @route GET /api/v1/tasks/user/count
 */
export const getTotalTasksForUser = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
        return res.status(401).json({ message: 'User not found' });
    }

    try {
        const count = await prisma.tasks.count({
            where: {
                computer: {
                    user_id: BigInt(userId),
                },  
            }
        });
        res.status(200).json({ totalTasks: count });
    } catch (error) {
        console.error("Error counting tasks:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * @description Get all tasks for the logged-in user
 * @route GET /api/v1/tasks/user
 */
export const getTasksForUser = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
        return res.status(401).json({ message: 'User not found' });
    }

    try {

        const tasks = await prisma.tasks.findMany({
            where: {
                computer: {
                    user_id: BigInt(userId)
                }
            },
            orderBy: {
                created_at: 'desc' 
            },

            include: {
                computer: {
                    select: { name: true }
                }
            }
        });
        
        const formattedTasks = tasks.map(task => ({
            ...task,
            id: task.id.toString(),
            computer_id: task.computer_id.toString(),
            computerName: task.computer.name 
        }));

        res.status(200).json(formattedTasks);

    } catch (error) {
        console.error("Error fetching tasks for user:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};