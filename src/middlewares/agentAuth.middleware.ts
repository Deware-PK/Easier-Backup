import { type Request, type Response, type NextFunction } from 'express';
import { verifyAgentRegisterToken } from '../services/token.service.js';

// Define a request type that might contain the agent registration user info
export interface AgentAuthRequest extends Request {
  agentRegUser?: {
    sub: string; // User ID who requested the registration
    scope: string;
    iat?: number;
  };
}

/**
 * Middleware to protect routes that require a valid Agent Registration Token.
 * Reads the token from the Authorization: Bearer header.
 */
export const protectAgentRegister = async (req: AgentAuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // 1. Extract token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  // 2. Verify the token and scope using the specific verification function
  try {
    const decoded = verifyAgentRegisterToken(token);

    if (!decoded) {
      // Token is invalid, expired, or doesn't have the required scope
      return res.status(401).json({ message: 'Not authorized, invalid or expired registration token' });
    }

    // 3. Attach user info (ID) to the request object for the controller to use
    req.agentRegUser = {
      sub: decoded.sub,
      scope: decoded.scope,
      iat: decoded.iat,
    };

    return next(); // Token is valid and has the correct scope, proceed

  } catch (error) {
    // Catch unexpected errors during verification (though verifyAgentRegisterToken should handle JWT errors)
    console.error("Unexpected error during agent registration token verification:", error);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};