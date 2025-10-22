import { type Request, type Response, type NextFunction } from 'express';
import { verifyUserToken } from '../services/token.service.js';
import prisma from '../db.js';

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    role: string;
    iat?: number;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = verifyUserToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Not authorized, token failed' });
      }

      // Revoke tokens issued before last password change
      const user = await prisma.users.findUnique({
        where: { id: BigInt(decoded.sub) },
        select: { password_changed_at: true, role: true },
      });

      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      if (user.password_changed_at && decoded.iat) {
        const tokenIatMs = decoded.iat * 1000;
        if (tokenIatMs < new Date(user.password_changed_at).getTime()) {
          return res.status(401).json({ message: 'Not authorized, token revoked' });
        }
      }

      req.user = { sub: decoded.sub, role: decoded.role, iat: decoded.iat };
      return next();

    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Middleware for Admin only.
 */
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};