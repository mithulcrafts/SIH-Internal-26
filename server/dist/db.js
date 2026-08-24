"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrismaEnabled = exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Standard singleton Prisma client. Used by all route handlers when
// DATABASE_URL is configured. When DATABASE_URL is absent, the server falls
// back to the in-memory mock store (see ./mockStore) for local preview.
const globalForPrisma = globalThis;
exports.prisma = process.env.DATABASE_URL
    ? globalForPrisma.prisma ?? (globalForPrisma.prisma = new client_1.PrismaClient())
    : null;
const isPrismaEnabled = () => exports.prisma !== null;
exports.isPrismaEnabled = isPrismaEnabled;
//# sourceMappingURL=db.js.map