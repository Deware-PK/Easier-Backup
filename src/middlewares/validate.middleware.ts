import { type Request, type Response, type NextFunction } from 'express';
import { sanitizePath } from '../utils/pathValidator.js';

type Rule = (v: any) => string | null;

export const v = {
  // Required string
  requiredString:
    (min = 1, max = 255): Rule =>
      (v) => (typeof v === 'string' && v.trim().length >= min && v.length <= max) ? null : `must be string length ${min}-${max}`,
  
  // Optional string
  optionalString:
    (min = 0, max = 255): Rule =>
      (v) => {
        if (v === undefined || v === null || v === '') return null;
        return (typeof v === 'string' && v.trim().length >= min && v.length <= max) ? null : `must be string length ${min}-${max}`;
      },
  
  email: (): Rule =>
      (v) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? null : 'must be a valid email',
  
  // Required int
  intIn:
    (min: number, max: number): Rule =>
      (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= min && n <= max ? null : `must be integer in ${min}-${max}`;
      },
  
  // Optional int
  optionalIntIn:
    (min: number, max: number): Rule =>
      (v) => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return Number.isInteger(n) && n >= min && n <= max ? null : `must be integer in ${min}-${max}`;
      },
  
  oneOf:
    <T extends readonly string[]>(allowed: T): Rule =>
      (v) => (allowed.includes(String(v)) ? null : `must be one of: ${allowed.join(', ')}`),
  
  // Optional oneOf
  optionalOneOf:
    <T extends readonly string[]>(allowed: T): Rule =>
      (v) => {
        if (v === undefined || v === null || v === '') return null;
        return allowed.includes(String(v)) ? null : `must be one of: ${allowed.join(', ')}`;
      },
  
  // Required boolean
  requiredBoolean: (): Rule =>
    (v) => (typeof v === 'boolean') ? null : 'must be boolean (true or false)',
  
  // Optional boolean
  optionalBoolean: (): Rule =>
    (v) => {
      if (v === undefined || v === null) return null;
      return (typeof v === 'boolean') ? null : 'must be boolean (true or false)';
    },

  // Safe path validator (path traversal)
  safePath: (): Rule =>
    (v) => {
      if (typeof v !== 'string') return 'must be a string';
      const sanitized = sanitizePath(v);
      return sanitized !== null ? null : 'invalid or unsafe path (path traversal detected)';
    },
};

export function validateBody(schema: Record<string, Rule>) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const [field, rule] of Object.entries(schema)) {
      const err = rule((req.body as any)[field]);
      if (err) return res.status(400).json({ message: `Invalid "${field}": ${err}` });
    }
    next();
  };
}

export function validateEmptyBody() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && Object.keys(req.body).length > 0) {
      return res.status(400).json({ message: 'Request body must be empty' });
    }
    next();
  };
}