import { type Response } from 'express';
import prisma from '../../db.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import { generateAgentToken } from '../../services/token.service.js';

/**
 * @description Register a new computer for the logged-in user
 * @route POST /api/v1/computers
 */
export const registerComputer = async (req: AuthRequest, res: Response) => {
    const { name, os, default_backup_keep_count, default_retry_attempts, default_retry_delay_seconds } = req.body;
    const userId = req.user?.sub;

    if (!name) {
        return res.status(400).json({ message: 'Please specify computer name' });
    }

    if (!userId) {
        return res.status(401).json({ message: 'UserId not found!' });
    }

    try {
        const agentToken = generateAgentToken();
        const newComputer = await prisma.computers.create({
            data: {
                name,
                os: os || 'Unknown',
                user_id: BigInt(userId),
                auth_token: agentToken,
                // New fields
                default_backup_keep_count: default_backup_keep_count ? parseInt(default_backup_keep_count) : undefined,
                default_retry_attempts: default_retry_attempts ? parseInt(default_retry_attempts) : undefined,
                default_retry_delay_seconds: default_retry_delay_seconds ? parseInt(default_retry_delay_seconds) : undefined,
            }
        });

        res.status(201).json({
            message: 'Registered Computer Successfully',
            computer: {
                id: newComputer.id.toString(),
                name: newComputer.name,
            },
            
            agentToken: newComputer.auth_token,
        });

    } catch (error) {
        console.error("Error while registering computer: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

/**
 * @description Get all computers for the logged-in user
 * @route GET /api/v1/computers
 */
export const getUserComputers = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
        return res.status(401).json({ message: 'UserId not found!' });
    }

    try {
        const computers = await prisma.computers.findMany({
            where: { user_id: BigInt(userId) },
            // 👇 แก้ไขตรงนี้: ใช้ select อย่างเดียว แล้วใส่ _count เข้าไปใน select
            select: {
                id: true,
                name: true,
                os: true,
                status: true,
                last_seen_at: true,
                default_backup_keep_count: true,
                default_retry_attempts: true,
                default_retry_delay_seconds: true,
                _count: { // 👈 _count สามารถอยู่ใน select ได้เลย
                    select: { tasks: true } 
                }
            },
            orderBy: { registered_at: 'asc' }
        });

        const formattedComputers = computers.map(computer => ({
            id: computer.id.toString(),
            name: computer.name,
            os: computer.os,
            status: computer.status,
            last_seen_at: computer.last_seen_at,
            taskCount: computer._count.tasks,
            default_backup_keep_count: computer.default_backup_keep_count,
            default_retry_attempts: computer.default_retry_attempts,
            default_retry_delay_seconds: computer.default_retry_delay_seconds,
        }));

        res.status(200).json(formattedComputers);

    } catch (error) {
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

/**
 * @description Update computer name
 * @route PUT /api/v1/computers/:computerId
 */
export const updateComputerName = async (req: AuthRequest, res: Response) => {
    const { computerId } = req.params;
    const { name } = req.body;
    const userId = req.user?.sub;

    if (!computerId || !/^\d+$/.test(computerId)) {
        return res.status(400).json({ message: 'Invalid computerId' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Please specify computer name' });
    }

    if (!userId) {
        return res.status(401).json({ message: 'UserId not found!' });
    }

    try {
        
        const computer = await prisma.computers.findFirst({
            where: { id: BigInt(computerId), user_id: BigInt(userId) },
            select: { id: true }
        });

        if (!computer) {
            return res.status(403).json({ message: "You don't have permission!" });
        }

        
        const updated = await prisma.computers.update({
            where: { id: BigInt(computerId) },
            data: { name: name.trim() },
            select: {
                id: true,
                name: true,
                os: true,
                status: true
            }
        });

        return res.status(200).json({
            message: 'Computer name updated successfully',
            computer: {
                id: updated.id.toString(),
                name: updated.name,
                os: updated.os,
                status: updated.status
            }
        });
        
    } catch (error) {
        console.error('Error updating computer name:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

/**
 * @description Delete a computer (and cascade delete its tasks and jobs)
 * @route DELETE /api/v1/computers/:computerId
 */
export const deleteComputer = async (req: AuthRequest, res: Response) => {
    const { computerId } = req.params;
    const userId = req.user?.sub;

    if (!computerId || !/^\d+$/.test(computerId)) {
        return res.status(400).json({ message: 'Invalid computerId' });
    }
    if (!userId) {
        return res.status(401).json({ message: 'UserId not found!' });
    }

    try {
        
        const computer = await prisma.computers.findFirst({
            where: { id: BigInt(computerId), user_id: BigInt(userId) },
            select: { id: true }
        });

        if (!computer) {
            return res.status(403).json({ message: "You don't have permission!" });
        }

        
        await prisma.computers.delete({ where: { id: BigInt(computerId) } });

        return res.status(200).json({ message: 'Computer deleted successfully (tasks and jobs removed).' });
    } catch (error) {
        console.error('Error deleting computer:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};