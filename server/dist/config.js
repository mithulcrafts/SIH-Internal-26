"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUPING_ROUTE_PADDING_KM = exports.GROUPING_DIRECTION_TOLERANCE_DEGREES = exports.GROUPING_TIME_TOLERANCE_MINUTES = exports.USE_LIVE_GOOGLE_MAPS = void 0;
exports.USE_LIVE_GOOGLE_MAPS = process.env.USE_LIVE_GOOGLE_MAPS === 'true' && Boolean(process.env.GOOGLE_MAPS_API_KEY);
exports.GROUPING_TIME_TOLERANCE_MINUTES = 15;
exports.GROUPING_DIRECTION_TOLERANCE_DEGREES = 20;
exports.GROUPING_ROUTE_PADDING_KM = 1;
//# sourceMappingURL=config.js.map