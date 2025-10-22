import { type Request, type Response } from 'express';
import prisma from '../../db.js';
import { hashPassword, comparePassword } from '../../services/password.service.js';
import { generateUserToken } from '../../services/token.service.js';
import { Prisma } from '@prisma/client';
import { logAudit } from '../../middlewares/audit.middleware.js';

/**
 * @description Register a new user
 * @route POST /api/v1/users/register
 */
export const registerUser = async (req: Request, res: Response) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please fill all of the fields' });
    }

    try {
        const hashedPassword = await hashPassword(password);

        const newUser = await prisma.users.create({
            data: {
                username,
                email,
                password_hash: hashedPassword,
            },
        });

        await logAudit(req, { action: 'register', status: 'success', details: `User: ${username}` });

        res.status(201).json({
            message: 'Registered successfully!',
            user: {
                id: newUser.id.toString(),
                username: newUser.username,
                email: newUser.email
            }
        });

    } catch (error) {

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
              await logAudit(req, { action: 'register', status: 'failed', details: 'Duplicate username/email' });
              return res.status(409).json({ message: 'Username or email already in use' });
          }
        }

        logError('User Registration', error);
        return res.status(500).json({ message: 'Internal Error Server' });
    };
};

/**
 * @description Authenticate a user and return a JWT
 * @route POST /api/v1/users/login
 */
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please fill Email and Password!' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      await logAudit(req, { action: 'login', status: 'failed', details: 'User not found' });
      return res.status(401).json({ message: 'Email or Password is incorrect!' });
    }

    const isPasswordCorrect = await comparePassword(password, user.password_hash);

    if (!isPasswordCorrect) {
      await logAudit(req, { action: 'login', status: 'failed', details: 'Wrong password' });
      return res.status(401).json({ message: 'Email or Password is incorrect!' });
    }

    const token = generateUserToken(user.id, user.role);

    await logAudit(req, { action: 'login', status: 'success', details: `User: ${user.username}` });

    res.status(200).json({
      message: 'Logged in successfully!',
      username: user.username,
      token: token,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Error Server' });
  }
};

export function logError(context: string, error: any) {
  const sanitized = {
    message: error?.message || 'Unknown error',
    code: error?.code,
    context
  };
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  } else {
    console.error(`[${context}]`, sanitized);
  }
}