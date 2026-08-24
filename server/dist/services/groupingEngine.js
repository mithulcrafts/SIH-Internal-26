"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clusterRideRequests = clusterRideRequests;
exports.isCompatible = isCompatible;
exports.directionVector = directionVector;
exports.routeDetourKm = routeDetourKm;
exports.haversine = haversine;
const config_1 = require("../config");
const capacityFor = (vehicleType) => vehicleType === 'CAB_4' ? 4 : 3;
const minutes = (value) => value * 60 * 1000;
/** Greedily builds capacity-safe pools, preferring the smallest incremental route detour. */
function clusterRideRequests(requests, vehicleType) {
    const eligible = requests
        .filter((request) => !vehicleType || request.vehicleType === vehicleType)
        .filter((request) => Number.isFinite(request.pickupLat) && Number.isFinite(request.dropoffLat))
        .sort((a, b) => a.flexTimeStart.getTime() - b.flexTimeStart.getTime());
    const unmatched = new Set(eligible.map((request) => request.id));
    const clusters = [];
    for (const seed of eligible) {
        if (!unmatched.has(seed.id))
            continue;
        const capacity = capacityFor(seed.vehicleType);
        const rides = [seed];
        unmatched.delete(seed.id);
        while (rides.length < capacity) {
            const candidates = eligible.filter((candidate) => {
                if (!unmatched.has(candidate.id) || candidate.vehicleType !== seed.vehicleType)
                    return false;
                return isCompatible(candidate, rides);
            });
            if (candidates.length === 0)
                break;
            const best = candidates.reduce((winner, candidate) => {
                const winnerCost = addedDetourKm(rides, winner);
                const candidateCost = addedDetourKm(rides, candidate);
                return candidateCost < winnerCost ? candidate : winner;
            });
            rides.push(best);
            unmatched.delete(best.id);
        }
        clusters.push({
            vehicleType: seed.vehicleType,
            rides,
            capacity,
            timeWindow: getSharedWindow(rides),
            totalDetourKm: routeDetourKm(rides),
        });
    }
    return clusters;
}
/** Returns true when time, direction, and spatial bounding constraints all pass. */
function isCompatible(candidate, cluster) {
    const clusterWindow = getSharedWindow(cluster);
    const candidateStart = candidate.flexTimeStart.getTime() - minutes(config_1.GROUPING_TIME_TOLERANCE_MINUTES);
    const candidateEnd = candidate.flexTimeEnd.getTime() + minutes(config_1.GROUPING_TIME_TOLERANCE_MINUTES);
    if (candidateStart > clusterWindow.end.getTime() || candidateEnd < clusterWindow.start.getTime())
        return false;
    const seed = cluster[0];
    const angleDifference = angularDifference(directionVector(seed), directionVector(candidate));
    if (angleDifference > config_1.GROUPING_DIRECTION_TOLERANCE_DEGREES)
        return false;
    const points = cluster.flatMap((ride) => [
        { lat: ride.pickupLat, lng: ride.pickupLng },
        { lat: ride.dropoffLat, lng: ride.dropoffLng },
    ]);
    const latitudes = points.map((point) => point.lat);
    const longitudes = points.map((point) => point.lng);
    const latPadding = config_1.GROUPING_ROUTE_PADDING_KM / 111;
    const lngPadding = config_1.GROUPING_ROUTE_PADDING_KM / (111 * Math.max(Math.cos(toRadians(seed.pickupLat)), 0.2));
    const candidatePoints = [
        { lat: candidate.pickupLat, lng: candidate.pickupLng },
        { lat: candidate.dropoffLat, lng: candidate.dropoffLng },
    ];
    return candidatePoints.every((point) => point.lat >= Math.min(...latitudes) - latPadding &&
        point.lat <= Math.max(...latitudes) + latPadding &&
        point.lng >= Math.min(...longitudes) - lngPadding &&
        point.lng <= Math.max(...longitudes) + lngPadding);
}
function directionVector(ride) {
    const latitudeScale = Math.cos(toRadians(ride.pickupLat));
    return {
        x: (ride.dropoffLng - ride.pickupLng) * latitudeScale,
        y: ride.dropoffLat - ride.pickupLat,
    };
}
function routeDetourKm(rides) {
    if (rides.length <= 1)
        return 0;
    const directDistance = rides.reduce((sum, ride) => sum + haversine(ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng), 0);
    const pickupHub = rides.reduce((point, ride) => ({ lat: point.lat + ride.pickupLat, lng: point.lng + ride.pickupLng }), { lat: 0, lng: 0 });
    pickupHub.lat /= rides.length;
    pickupHub.lng /= rides.length;
    const dropoffHub = rides.reduce((point, ride) => ({ lat: point.lat + ride.dropoffLat, lng: point.lng + ride.dropoffLng }), { lat: 0, lng: 0 });
    dropoffHub.lat /= rides.length;
    dropoffHub.lng /= rides.length;
    const sharedDistance = haversine(pickupHub.lat, pickupHub.lng, dropoffHub.lat, dropoffHub.lng);
    return Math.max(0, sharedDistance + averageDistanceTo(rides, pickupHub) + averageDistanceTo(rides, dropoffHub) - directDistance);
}
function addedDetourKm(cluster, candidate) {
    return routeDetourKm([...cluster, candidate]) - routeDetourKm(cluster);
}
function getSharedWindow(rides) {
    const start = new Date(Math.max(...rides.map((ride) => ride.flexTimeStart.getTime())));
    const end = new Date(Math.min(...rides.map((ride) => ride.flexTimeEnd.getTime())));
    return start <= end ? { start, end } : { start: rides[0].flexTimeStart, end: rides[0].flexTimeEnd };
}
function averageDistanceTo(rides, point) {
    return rides.reduce((sum, ride) => sum + haversine(point.lat, point.lng, ride.pickupLat, ride.pickupLng), 0) / rides.length;
}
function angularDifference(a, b) {
    const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (denominator === 0)
        return 0;
    const cosine = Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y) / denominator));
    return Math.acos(cosine) * (180 / Math.PI);
}
function toRadians(value) { return value * Math.PI / 180; }
function haversine(lat1, lng1, lat2, lng2) {
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.asin(Math.sqrt(a));
}
//# sourceMappingURL=groupingEngine.js.map