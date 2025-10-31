import { type Request } from 'express';
import { AuthRequest } from './auth.middleware.js';
import prisma from '../db.js';

type AuditAction = 
  | 'login' | 'register' | 'logout'
  | 'create_computer' | 'update_computer' | 'delete_computer' | 'register_computer'
  | 'create_task' | 'update_task' | 'delete_task' | 'start_task_now'
  | 'view_audit_logs'
  | 'generate_recovery_codes' | 'reset_password'
  | 'request_agent_reg_token';

interface AuditData {
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: string;
  status: 'success' | 'failed';
}

export async function logAudit(req: Request, data: AuditData) {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.sub ? BigInt(authReq.user.sub) : null;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        ip_address: ip,
        action: data.action,
        resource: data.resource || null,
        resource_id: data.resourceId || null,
        details: data.details || null,
        status: data.status,
      }
    });
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}