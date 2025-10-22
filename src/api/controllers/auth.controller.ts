import { type Request, type Response } from 'express';
import crypto from 'crypto';
import prisma from '../../db.js';
import { hashPassword } from '../../services/password.service.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import { logAudit } from '../../middlewares/audit.middleware.js';

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCodes(n = 10): string[] {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(6).toString('base64url').slice(0, 12).toUpperCase()
  );
}

/**
 * POST /api/v1/auth/recovery-codes
 * Require login: สร้างชุดโค้ดใหม่ (ล้างของเดิม) แล้วส่งให้ผู้ใช้เก็บไว้
 */
export async function generateRecoveryCodes(req: AuthRequest, res: Response) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const codes = generateCodes(10);
  const hashes = codes.map(c => ({ user_id: BigInt(userId), code_hash: hashCode(c) }));

  await prisma.$transaction(async (tx) => {
    await tx.password_recovery_codes.deleteMany({ where: { user_id: BigInt(userId), used_at: null } });
    await tx.password_recovery_codes.createMany({ data: hashes });
    
    // รีเซ็ต recovery_codes_viewed เป็น false เพราะสร้างโค้ดใหม่
    await tx.users.update({
      where: { id: BigInt(userId) },
      data: { recovery_codes_viewed: false }
    });
  });

  await logAudit(req, { action: 'generate_recovery_codes', status: 'success' });

  res.json({ codes });
}

/**
 * GET /api/v1/auth/recovery-codes-status
 * ตรวจสอบว่า user ดู recovery codes ไปแล้วหรือยัง
 */
export async function getRecoveryCodesStatus(req: AuthRequest, res: Response) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const user = await prisma.users.findUnique({
      where: { id: BigInt(userId) },
      select: { recovery_codes_viewed: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // นับจำนวนโค้ดที่ยังไม่ถูกใช้
    const activeCodesCount = await prisma.password_recovery_codes.count({
      where: { user_id: BigInt(userId), used_at: null }
    });

    res.json({
      recovery_codes_viewed: user.recovery_codes_viewed,
      has_active_codes: activeCodesCount > 0,
      active_codes_count: activeCodesCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

/**
 * POST /api/v1/auth/recovery-codes-viewed
 * อัปเดตสถานะว่าผู้ใช้ดู recovery codes แล้ว
 * body: { viewed: boolean }
 */
export async function updateRecoveryCodesViewed(req: AuthRequest, res: Response) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { viewed } = req.body as { viewed?: boolean };

  if (typeof viewed !== 'boolean') {
    return res.status(400).json({ message: 'Invalid "viewed": must be boolean' });
  }

  try {
    await prisma.users.update({
      where: { id: BigInt(userId) },
      data: { recovery_codes_viewed: viewed }
    });

    await logAudit(req, {
      action: 'generate_recovery_codes',
      status: 'success',
      details: `Updated recovery_codes_viewed to ${viewed}`
    });

    res.json({ message: 'Status updated successfully', recovery_codes_viewed: viewed });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

/**
 * POST /api/v1/auth/reset-with-code
 * body: { email, code, password }
 * ใช้โค้ดสำรอง + อีเมล เพื่อรีเซ็ตรหัสผ่าน (ไม่บอกว่าอีเมลมี/ไม่มี)
 */
export async function resetWithRecoveryCode(req: Request, res: Response) {
  const { email, code, password } = req.body as { email?: string; code?: string; password?: string };

  const generic = { message: 'If the data is valid, your password has been reset.' };

  if (!email || !code || !password || password.length < 8) {
    return res.status(200).json(generic);
  }

  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(200).json(generic);

    const codeHash = hashCode(code);

    const match = await prisma.password_recovery_codes.findFirst({
      where: { user_id: user.id, code_hash: codeHash, used_at: null }
    });
    if (!match) return res.status(200).json(generic);

    const now = new Date();
    const newHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user.id },
        data: { password_hash: newHash, password_changed_at: now }
      });
      await tx.password_recovery_codes.update({
        where: { id: match.id },
        data: { used_at: now }
      });
      await tx.password_recovery_codes.deleteMany({
        where: { user_id: user.id, used_at: null }
      });
    });

    await logAudit(req as any, { action: 'reset_password', status: 'success', details: `email=${email}` });

    return res.status(200).json(generic);
  } catch {
    return res.status(200).json(generic);
  }
}