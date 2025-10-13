import { type Response } from 'express';
import prisma from '../../db.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import { generateAgentToken } from '../../services/token.service.js';

/**
 * @description Register a new computer for the logged-in user
 * @route POST /api/v1/computers
 */
export const registerComputer = async (req: AuthRequest, res: Response) => {
    const { name, os } = req.body;
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
            where: {
                user_id: BigInt(userId),
            },
            
            select: {
                id: true,
                name: true,
                os: true,
                status: true,
                last_seen_at: true,
            },
        });

        const formattedComputers = computers.map(computer => ({
            ...computer,
            id: computer.id.toString()
        }));

        res.status(200).json(formattedComputers);
        
    } catch (error) {
        console.error("Error while pulling computers data: ", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
} 