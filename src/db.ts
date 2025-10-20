import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const log: (Prisma.LogLevel | Prisma.LogDefinition)[] = ['warn', 'error'];
if (process.env.NODE_ENV === 'development') {

  if (process.env.PRISMA_LOG_QUERIES === '1') {
    log.push({ level: 'query', emit: 'event' });
  }
  log.push('info');
}

const prisma = global.prisma || new PrismaClient({ log });

if (process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG_QUERIES === '1') {
  (prisma as unknown as PrismaClient<Prisma.PrismaClientOptions, 'query'>).$on('query', (e: Prisma.QueryEvent) => {
    const maskedParams = maskSensitiveParams(e.params);
    console.info(`[Prisma] ${e.duration}ms ${e.query}\nparams=${maskedParams}`);
  });
}


function maskSensitiveParams(paramsJson: string): string {
  try {
    const obj = JSON.parse(paramsJson);

    const sensitive = new Set([
      'password', 'password_hash', 'pass', 'pwd',
      'auth_token', 'token', 'access_token', 'refresh_token',
      'jwt', 'authorization', 'api_key', 'secret', 'client_secret'
    ]);

    const redact = (o: any) => {
      if (!o || typeof o !== 'object') return;

      if (Array.isArray(o)) {
        for (const item of o) redact(item);
        return;
      }

      for (const k of Object.keys(o)) {
        const key = k.toLowerCase();
        if (sensitive.has(key)) {
          o[k] = '***';
        } else if (typeof o[k] === 'object') {
          redact(o[k]);
        }
      }
    };

    redact(obj);
    return JSON.stringify(obj);
  } catch {
    return '[unparsable]';
  }
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;