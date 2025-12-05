import { PrismaClient } from '@prisma/client';

// Declaração global para BigInt.toJSON
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;

  interface BigInt {
    toJSON(): string;
  }
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
    // Configuração otimizada do pool de conexões
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

const prisma = global.prisma ?? prismaClientSingleton();

// Configurar serialização de BigInt para JSON
if (typeof BigInt.prototype.toJSON === 'undefined') {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
