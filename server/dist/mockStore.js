"use strict";
// In-memory mock store used ONLY when DATABASE_URL is not set, so the server
// can run in local browser preview (WebContainers) without a live Postgres.
// All production queries target the Prisma PostgreSQL client in db.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockStore = void 0;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
exports.mockStore = {
    users: [],
    rideRequests: [],
    pools: [],
    poolMembers: [],
    chatMessages: [],
    nextId: uid,
};
//# sourceMappingURL=mockStore.js.map