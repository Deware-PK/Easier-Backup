import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

// Secret settings
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-for-dev-only';
const JWT_EXPIRES_IN = '1d';
const AGENT_REG_JWT_EXPIRES_IN = '5m';
const AGENT_REG_SCOPE = 'agent:register';

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
export const verifyUserToken = (token: string): { sub: string; role: string; iat: number } | null => {

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-dev-only') {
            throw new Error('JWT_SECRET must be set securely in production');
        }
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string; iat: number };
        
        return decoded;
    } catch (error) {
        return null;
    }
};

/**
 * Creates a short-lived JWT specifically for agent computer registration.
 * @param userId - ID of the user owning the agent
 * @returns {string} The agent registration JWT
 */
export const generateAgentRegisterToken = (userId: BigInt): string => {
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-dev-only') {
            throw new Error('JWT_SECRET must be set securely in production');
        }
    }
    const payload = {
        sub: userId.toString(),
        scope: AGENT_REG_SCOPE, // <<<--- ใส่ Scope
    };
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: AGENT_REG_JWT_EXPIRES_IN, // <<<--- ใช้อายุสั้น
    });
};

/**
 * Verifies a JWT and checks if it has the agent registration scope.
 * @param token - The JWT token string from Authorization Header
 * @returns { { sub: string; scope: string; iat: number; exp: number } | null } Decoded payload if valid and has correct scope, otherwise null.
 */
export const verifyAgentRegisterToken = (token: string): { sub: string; scope: string; iat: number; exp: number } | null => {
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-dev-only') {
            throw new Error('JWT_SECRET must be set securely in production');
        }
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; scope: string; iat: number; exp: number };
        // Check for required claims AND the specific scope
        if (decoded && decoded.sub && decoded.scope === AGENT_REG_SCOPE && decoded.iat && decoded.exp) {
            return decoded;
        }
        return null; // Invalid structure or missing/wrong scope
    } catch (error) {
        // Catches expired tokens, invalid signatures, etc.
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