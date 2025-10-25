import { type Request, type Response, type NextFunction } from 'express';
import { verifyUserToken } from '../services/token.service.js';
import prisma from '../db.js';

function parseCookies(cookieHeader: string | undefined): { [key: string]: string } {
  const cookies: { [key: string]: string } = {};
  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    cookies[name] = value;
  });

  return cookies;
}

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    role: string;
    iat?: number;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Checking if token is expired and return 401
  const parsedCookies = parseCookies(req.headers.cookie);
  req.cookies = parsedCookies;
  token = req.cookies?.SESSION_TOKEN__DO_NOT_SHARE;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

    try {

      const decoded = verifyUserToken(token);
      
      if (!decoded) {
        res.clearCookie('SESSION_TOKEN__DO_NOT_SHARE', { path: '/' });
        res.clearCookie('SESSION_EXPIRES_AT', { path: '/' });
        return res.status(401).json({ message: 'Not authorized, token failed or expired' });
      }

      // Revoke tokens issued before last password change
      const user = await prisma.users.findUnique({
        where: { id: BigInt(decoded.sub) },
        select: { password_changed_at: true, role: true },
      });

      if (!user) {
        res.clearCookie('SESSION_TOKEN__DO_NOT_SHARE', { path: '/' });
        res.clearCookie('SESSION_EXPIRES_AT', { path: '/' });
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      if (user.password_changed_at && decoded.iat) {
        const tokenIatMs = decoded.iat * 1000;
        if (tokenIatMs < new Date(user.password_changed_at).getTime()) {
          res.clearCookie('SESSION_TOKEN__DO_NOT_SHARE', { path: '/' });
          res.clearCookie('SESSION_EXPIRES_AT', { path: '/' });
          return res.status(401).json({ message: 'Not authorized, token revoked' });
        }
      }

      req.user = { sub: decoded.sub, role: decoded.role, iat: decoded.iat };
      return next();

    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
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