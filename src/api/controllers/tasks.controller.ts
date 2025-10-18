import { type Response } from "express";
import { type AuthRequest } from '../../middlewares/auth.middleware.js';
import prisma from '../../db.js';

/**
 * @description Create a new backup task for a specific computer
 * @route POST /api/v1/tasks
 */
export const createTask = async (req: AuthRequest, res: Response) => {
    const { computer_id, name, source_path, destination_path, schedule } = req.body;
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
                source_path,
                destination_path,
                schedule,
            }
        });

        res.status(201).json({
            ...newTask,
            id: newTask.id.toString(),
            computer_id: newTask.computer_id.toString(),
        });



    } catch (error) {
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

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
    const { name, source_path, destination_path, schedule, is_active } = req.body;

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
                source_path,
                destination_path,
                schedule,
                is_active,
            },
        });

        res.status(200).json({
            ...updatedTask,
            id: updatedTask.id.toString(),
            computer_id: updatedTask.computer_id.toString(),
        });

    } catch (error) {
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

        res.status(200).json({ message: 'Task deleted successfully!' });

    } catch (error) {
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