import { PrismaClient } from '@prisma/client'

let prisma: any

try {
  const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
  }

  prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: ['query'],
    })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
} catch {
  console.warn('[AI Studio] Database not connected — using mock')
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  }
  prisma = new Proxy({}, { get: () => noOp })
}

export const db = prisma
export { prisma }
