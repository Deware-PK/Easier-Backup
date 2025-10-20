import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

// Secret settings
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-for-dev-only';
const JWT_EXPIRES_IN = '1d';

// --- User JWT Function ---

/**
 * Create JSON Web Token (JWT) for user with successfully login.
 * @param userId - ID of user
 * @param role - Roles ('user', 'admin')
 * @returns 
 */
export const generateUserToken = (userId: BigInt, role: string): string => {

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-dev-only') {
            throw new Error('JWT_SECRET must be set securely in production');
        }
    }

    const payload = {
        sub: userId.toString(),
        role: role,
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

/**
 * Verify and decoded JWT from user
 * @param token - JWT Token from Authorization Header
 * @returns 
 */
export const verifyUserToken = (token: string): { sub: string, role: string } | null => {

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-dev-only') {
            throw new Error('JWT_SECRET must be set securely in production');
        }
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded as { sub: string, role: string };
    } catch (error) {
        return null;
    }
};

// --- Helper Function ---

/**
 * Craete randomize token
 * @returns - Token - Hex String long 64 character.
 */
export const generateAgentToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
}