import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const logLevels: Prisma.LogLevel[] = process.env.NODE_ENV === 'development' 
  ? ['query', 'info', 'warn', 'error']
  : ['warn', 'error'];

const prisma = global.prisma || new PrismaClient({
  log: logLevels,
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;