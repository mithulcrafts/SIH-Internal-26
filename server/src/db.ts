import { PrismaClient } from '@prisma/client'

// Standard singleton Prisma client. Used by all route handlers when
// DATABASE_URL is configured. When DATABASE_URL is absent, the server falls
// back to the in-memory mock store (see ./mockStore) for local preview.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient | null =
  process.env.DATABASE_URL
    ? globalForPrisma.prisma ?? (globalForPrisma.prisma = new PrismaClient())
    : null

export const isPrismaEnabled = (): boolean => prisma !== null
