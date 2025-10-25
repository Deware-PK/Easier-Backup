import { Router } from 'express';
import { requestAgentRegisterToken } from '../controllers/agentAuth.controller.js';
import { validateBody, v } from '../../middlewares/validate.middleware.js';
import { createRateLimiter } from '../../middlewares/rateLimit.middleware.js';

const router = Router();

// Apply stricter rate limiting for requesting the registration token
const agentRegTokenLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Max 5 requests per 10 minutes per IP/Email combination
  keyGenerator: (req) => {
    // Key based on IP and lowercase email to prevent case sensitivity bypass
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown_email';
    return `agent-reg-token:${req.ip}:${email}`;
  },
  message: 'Too many agent registration token requests from this IP for this email, please try again later.'
});

// Define the route for requesting the agent registration token
router.post(
  '/request-token',
  agentRegTokenLimiter, // Apply rate limiting
  validateBody({        // Validate input
    email: v.email(),
    password: v.requiredString(8, 100), // Validate password length (matches user login validation)
  }),
  requestAgentRegisterToken // Call the controller function
);

export default router;