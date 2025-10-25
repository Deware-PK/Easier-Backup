import { type Request, type Response } from 'express';
import prisma from '../../db.js';
import { comparePassword } from '../../services/password.service.js';
import { generateAgentRegisterToken } from '../../services/token.service.js';
import { logAudit } from '../../middlewares/audit.middleware.js';
import { logError } from './users.controller.js'; // Reuse logError function

/**
 * @description Authenticates a user (via email/password) and returns a short-lived,
 * limited-scope JWT specifically for registering a new agent computer.
 * @route POST /api/v1/agent-auth/request-token
 */
export const requestAgentRegisterToken = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Basic input validation
  if (!email || !password) {
    // Log audit for failed attempt (generic details)
    await logAudit(req, { action: 'request_agent_reg_token', status: 'failed', details: 'Missing email or password' });
    // Return 400 Bad Request
    return res.status(400).json({ message: 'Please provide both email and password.' });
  }

  try {
    // Find the user by email
    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, password_hash: true, username: true }, // Select only necessary fields
    });

    // IMPORTANT: Timing attack prevention - Use comparePassword even if user not found.
    // Hash a dummy password if user doesn't exist to ensure similar processing time.
    const hashToCompare = user ? user.password_hash : '$2a$12$dummyHashForTimingAttackPrevention'; // Example dummy hash
    const isPasswordCorrect = await comparePassword(password, hashToCompare);

    if (!user || !isPasswordCorrect) {
      // Log audit for failed attempt
      await logAudit(req, { action: 'request_agent_reg_token', status: 'failed', details: `Attempt for email: ${email}` });
      // Return 401 Unauthorized - Keep message generic
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // --- Credentials are valid ---

    // Generate the short-lived, limited-scope token
    const agentRegToken = generateAgentRegisterToken(user.id);

    // Log successful token request
    await logAudit(req, { action: 'request_agent_reg_token', status: 'success', details: `User: ${user.username} (${email})` });

    // Return the token in the response body
    res.status(200).json({
      message: 'Agent registration token generated successfully. Valid for 5 minutes.',
      registrationToken: agentRegToken,
    });

  } catch (error) {
    // Log unexpected errors
    logError('Agent Registration Token Request', error);
    await logAudit(req, { action: 'request_agent_reg_token', status: 'failed', details: 'Internal server error' });
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};