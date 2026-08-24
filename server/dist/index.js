"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4000);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ ok: true, database: process.env.DATABASE_URL ? 'postgresql' : 'memory-preview' }));
app.use('/api', routes_1.default);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.listen(port, () => {
    process.stdout.write(`CampusPool API listening on port ${port}\n`);
});
//# sourceMappingURL=index.js.map