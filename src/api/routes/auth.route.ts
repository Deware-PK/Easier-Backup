import { Router } from 'express';
import {
  generateRecoveryCodes,
  getRecoveryCodesStatus,
  updateRecoveryCodesViewed,
  resetWithRecoveryCode
} from '../controllers/auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { validateBody, v } from '../../middlewares/validate.middleware.js';
import { createRateLimiter } from '../../middlewares/rateLimit.middleware.js';

const router = Router();

const genLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `gen-recovery:${(req as any).user?.sub ?? req.ip}`,
  message: 'Too many attempts, please try again later.'
});

const resetLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const email = typeof (req.body as any)?.email === 'string' ? (req.body as any).email.toLowerCase() : '';
    return `${req.ip}:reset-with-code:${email}`;
  },
  message: 'Too many attempts, please try again later.'
});

// สร้างโค้ดสำรอง (ล้างของเดิม + reset viewed status)
router.post(
  '/recovery-codes',
  protect,
  genLimiter,
  generateRecoveryCodes
);

// ตรวจสอบสถานะว่าผู้ใช้ดูโค้ดไปแล้วหรือยัง
router.get(
  '/recovery-codes-status',
  protect,
  getRecoveryCodesStatus
);

// อัปเดตสถานะว่าผู้ใช้ดูโค้ดแล้ว
router.post(
  '/recovery-codes-viewed',
  protect,
  validateBody({
    viewed: v.requiredBoolean(),
  }),
  updateRecoveryCodesViewed
);

// รีเซ็ตรหัสผ่านด้วยโค้ดสำรอง
router.post(
  '/reset-with-code',
  resetLimiter,
  validateBody({
    email: v.email(),
    code: v.requiredString(6, 64),
    password: v.requiredString(8, 128),
  }),
  resetWithRecoveryCode
);

export default router;