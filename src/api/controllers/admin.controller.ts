import { type Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import prisma from '../../db.js';
import { logAudit } from '../../middlewares/audit.middleware.js';

/**
 * @route GET /api/v1/admin/audit-logs
 */
export async function getAuditLogs(req: AuthRequest, res: Response) {
  const { page = '1', limit = '50', action, user_id, ip_address } = req.query;

  try {
    const where: any = {};
    if (action) where.action = action;
    if (user_id) where.user_id = BigInt(user_id as string);
    if (ip_address) where.ip_address = ip_address;

    const logs = await prisma.audit_logs.findMany({
      where,
      include: {
        user: { select: { username: true, email: true } }
      },
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.audit_logs.count({ where });

    await logAudit(req, { action: 'view_audit_logs', status: 'success' });

    res.json({
      logs: logs.map(log => ({
        ...log,
        id: log.id.toString(),
        user_id: log.user_id?.toString(),
      })),
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

/**
 * @route GET /api/v1/admin/stats
 */
export async function getStats(req: AuthRequest, res: Response) {
  try {
    const [totalUsers, totalComputers, totalTasks, recentLogs] = await Promise.all([
      prisma.users.count(),
      prisma.computers.count(),
      prisma.tasks.count(),
      prisma.audit_logs.count({
        where: {
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    res.json({ totalUsers, totalComputers, totalTasks, logsLast24h: recentLogs });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}