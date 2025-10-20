import { type Request, type Response, type NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;       
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
};

type Counter = { count: number; expiresAt: number };

const store = new Map<string, Counter>();

function defaultKey(req: Request) {
  return `${req.ip}:${req.baseUrl}${req.path}`;
}

export function createRateLimiter(opts: RateLimitOptions) {
  const windowMs = opts.windowMs;
  const max = opts.max;
  const keyGen = opts.keyGenerator ?? defaultKey;
  const message = opts.message ?? 'Too many requests, please try again later.';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyGen(req);
    const record = store.get(key);

    if (!record || record.expiresAt <= now) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (record.count >= max) {
      res.setHeader('Retry-After', String(Math.ceil((record.expiresAt - now) / 1000)));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.expiresAt / 1000)));
      return res.status(429).json({ message });
    }

    record.count += 1;
    store.set(key, record);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - record.count));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.expiresAt / 1000)));
    next();
  };
}

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req) => `${req.ip}:login`,
  message: 'Too many login attempts, please try again later.'
});

export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => `${req.ip}:register`,
  message: 'Too many registration attempts, please try again later.'
});


export const generalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req) => `${req.ip}:api`,
});