"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("./db");
const mockStore_1 = require("./mockStore");
const groupingEngine_1 = require("./services/groupingEngine");
const fareSplitter_1 = require("./services/fareSplitter");
const routeOptimizer_1 = require("./services/routeOptimizer");
const razorpay_1 = require("./services/razorpay");
const uber_1 = require("./services/uber");
const router = (0, express_1.Router)();
const jwtSecret = process.env.JWT_SECRET || 'development-only-secret';
const createToken = (userId) => jsonwebtoken_1.default.sign({ userId }, jwtSecret, { expiresIn: '7d' });
const bodyString = (value) => typeof value === 'string' ? value : '';
const bodyNumber = (value) => typeof value === 'number' ? value : Number(value);
const validIiitmEmail = (email) => /^[^@\s]+@iiitm\.ac\.in$/i.test(email);
const capacityFor = (vehicleType) => vehicleType === 'CAB_4' ? 4 : 3;
const fareFor = (vehicleType) => vehicleType === 'CAB_4' ? 276 : 204;
async function matchPendingRides(vehicleType, requireMultiple = false) {
    if (db_1.prisma) {
        const pending = await db_1.prisma.rideRequest.findMany({ where: { status: 'PENDING', vehicleType }, orderBy: { createdAt: 'asc' }, take: capacityFor(vehicleType) });
        const cluster = (0, groupingEngine_1.clusterRideRequests)(pending.map(toRideCandidate), vehicleType)[0];
        if (!cluster || (requireMultiple && cluster.rides.length < 2))
            return null;
        const pool = await db_1.prisma.pool.create({ data: { vehicleType, maxCapacity: cluster.capacity, status: cluster.rides.length >= cluster.capacity ? 'FULL' : 'OPEN', totalEstimatedFare: fareFor(vehicleType) } });
        await db_1.prisma.poolMember.createMany({ data: cluster.rides.map((ride, index) => ({ poolId: pool.id, userId: ride.userId, stopSequence: index + 1 })) });
        await db_1.prisma.rideRequest.updateMany({ where: { id: { in: cluster.rides.map((ride) => ride.id) } }, data: { status: 'MATCHED' } });
        return { pool, matchedRiders: cluster.rides.length };
    }
    const pending = mockStore_1.mockStore.rideRequests.filter((ride) => ride.status === 'PENDING' && ride.vehicleType === vehicleType).slice(0, capacityFor(vehicleType));
    const cluster = (0, groupingEngine_1.clusterRideRequests)(pending, vehicleType)[0];
    if (!cluster || (requireMultiple && cluster.rides.length < 2))
        return null;
    const pool = { id: mockStore_1.mockStore.nextId(), vehicleType, maxCapacity: cluster.capacity, status: cluster.rides.length >= cluster.capacity ? 'FULL' : 'OPEN', totalEstimatedFare: fareFor(vehicleType), driverDetails: null, shareTrackingUrl: null, createdAt: new Date() };
    mockStore_1.mockStore.pools.push(pool);
    cluster.rides.forEach((ride, index) => {
        const mockRide = mockStore_1.mockStore.rideRequests.find((r) => r.id === ride.id);
        if (mockRide)
            mockRide.status = 'MATCHED';
        mockStore_1.mockStore.poolMembers.push({ id: mockStore_1.mockStore.nextId(), poolId: pool.id, userId: ride.userId, stopSequence: index + 1, individualFare: 0, paymentStatus: 'PENDING', paymentId: null, createdAt: new Date() });
    });
    return { pool, matchedRiders: cluster.rides.length };
}
function toRideCandidate(ride) {
    return { id: ride.id, userId: ride.userId, pickupLat: ride.pickupLat, pickupLng: ride.pickupLng, dropoffLat: ride.dropoffLat, dropoffLng: ride.dropoffLng, flexTimeStart: ride.flexTimeStart, flexTimeEnd: ride.flexTimeEnd, vehicleType: ride.vehicleType };
}
router.post('/auth/send-otp', (req, res) => {
    const email = bodyString(req.body.email).toLowerCase();
    if (!validIiitmEmail(email))
        return res.status(400).json({ error: 'Use an @iiitm.ac.in email address.' });
    return res.json({ sent: true, expiresInSeconds: 300 });
});
router.post('/auth/verify-otp', async (req, res) => {
    const email = bodyString(req.body.email).toLowerCase();
    const otp = bodyString(req.body.otp);
    if (!validIiitmEmail(email) || otp !== '123456')
        return res.status(401).json({ error: 'Invalid verification code.' });
    if (db_1.prisma) {
        const user = await db_1.prisma.user.upsert({
            where: { email },
            update: {},
            create: { email, name: email.split('@')[0] },
        });
        return res.json({ token: createToken(user.id), user });
    }
    let user = mockStore_1.mockStore.users.find((candidate) => candidate.email === email);
    if (!user) {
        user = { id: mockStore_1.mockStore.nextId(), email, name: email.split('@')[0], rollNumber: null, emergencyContact: null, createdAt: new Date() };
        mockStore_1.mockStore.users.push(user);
    }
    return res.json({ token: createToken(user.id), user });
});
router.post('/rides/request', async (req, res) => {
    const payload = {
        userId: bodyString(req.body.userId),
        pickupLocationName: bodyString(req.body.pickupLocationName),
        dropoffLocationName: bodyString(req.body.dropoffLocationName),
        pickupLat: bodyNumber(req.body.pickupLat),
        pickupLng: bodyNumber(req.body.pickupLng),
        dropoffLat: bodyNumber(req.body.dropoffLat),
        dropoffLng: bodyNumber(req.body.dropoffLng),
        flexTimeStart: new Date(bodyString(req.body.flexTimeStart)),
        flexTimeEnd: new Date(bodyString(req.body.flexTimeEnd)),
        vehicleType: req.body.vehicleType === 'CAB_4' ? 'CAB_4' : 'AUTO_3',
    };
    if (db_1.prisma) {
        const ride = await db_1.prisma.rideRequest.create({ data: payload });
        await matchPendingRides(payload.vehicleType, true);
        return res.status(201).json(ride);
    }
    const ride = { ...payload, id: mockStore_1.mockStore.nextId(), status: 'PENDING', createdAt: new Date() };
    mockStore_1.mockStore.rideRequests.push(ride);
    await matchPendingRides(payload.vehicleType, true);
    return res.status(201).json(ride);
});
router.post('/pools/match', async (req, res) => {
    const vehicleType = req.body.vehicleType === 'CAB_4' ? 'CAB_4' : 'AUTO_3';
    const result = await matchPendingRides(vehicleType);
    if (!result)
        return res.status(200).json({ pool: null, matchedRiders: 0, message: 'No compatible pending rides found.' });
    return res.status(201).json(result);
});
router.post('/pools/:id/sequence', async (req, res) => {
    const waypoints = Array.isArray(req.body.waypoints) ? req.body.waypoints : [];
    if (waypoints.length > 1) {
        const route = await (0, routeOptimizer_1.optimizeRoute)({ origin: req.body.origin, waypoints, destination: req.body.destination });
        return res.json({ poolId: req.params.id, ...route, etaMinutes: Math.ceil(route.totalDistanceKm * 3) });
    }
    if (db_1.prisma) {
        const members = await db_1.prisma.poolMember.findMany({ where: { poolId: req.params.id }, orderBy: { stopSequence: 'asc' }, include: { user: true } });
        return res.json({ poolId: req.params.id, stops: members, totalDistanceKm: 0, provider: 'mock', etaMinutes: 25 });
    }
    const members = mockStore_1.mockStore.poolMembers.filter((member) => member.poolId === req.params.id).sort((a, b) => a.stopSequence - b.stopSequence);
    return res.json({ poolId: req.params.id, stops: members, totalDistanceKm: 0, provider: 'mock', etaMinutes: 25 });
});
router.post('/pools/:id/split', async (req, res) => {
    const totalFare = bodyNumber(req.body.totalFare) || 204;
    const distances = Array.isArray(req.body.distances) ? req.body.distances : [];
    if (db_1.prisma) {
        const members = await db_1.prisma.poolMember.findMany({ where: { poolId: req.params.id }, orderBy: { stopSequence: 'asc' } });
        const fareDistances = members.map((member) => ({ riderId: member.userId, distanceKm: Number(distances.find((item) => item.riderId === member.userId)?.distanceKm) || 0 }));
        const shares = await (0, fareSplitter_1.updatePoolMemberFares)(db_1.prisma, req.params.id, totalFare, fareDistances);
        return res.json({ shares });
    }
    const members = mockStore_1.mockStore.poolMembers.filter((member) => member.poolId === req.params.id).sort((a, b) => a.stopSequence - b.stopSequence);
    const fareDistances = members.map((member) => ({ riderId: member.userId, distanceKm: Number(distances.find((item) => item.riderId === member.userId)?.distanceKm) || 0 }));
    const shares = (0, fareSplitter_1.calculateDistanceWeightedFares)(totalFare, fareDistances);
    members.forEach((member) => { member.individualFare = shares.find((share) => share.riderId === member.userId)?.individualFare || 0; });
    return res.json({ shares });
});
router.post('/payments/mock-order', async (req, res) => {
    const order = await (0, razorpay_1.createOrder)(bodyNumber(req.body.amount), 'INR');
    return res.status(201).json({ ...order, currency: 'INR' });
});
router.post('/payments/verify', (req, res) => {
    const orderId = bodyString(req.body.orderId);
    const paymentId = bodyString(req.body.paymentId);
    const signature = bodyString(req.body.signature);
    if (orderId && paymentId && signature && !(0, razorpay_1.verifySignature)({ orderId, paymentId, signature }))
        return res.status(400).json({ verified: false, error: 'Invalid payment signature' });
    return res.json({ verified: true, paymentId: paymentId || `pay_demo_${mockStore_1.mockStore.nextId()}` });
});
router.post('/uber/mock-dispatch', async (req, res) => {
    const trip = await (0, uber_1.dispatchTrip)({ pickupLat: bodyNumber(req.body.pickupLat), pickupLng: bodyNumber(req.body.pickupLng), dropoffLat: bodyNumber(req.body.dropoffLat), dropoffLng: bodyNumber(req.body.dropoffLng) });
    if (db_1.prisma && bodyString(req.body.poolId)) {
        await db_1.prisma.pool.update({ where: { id: bodyString(req.body.poolId) }, data: { status: 'DISPATCHED', driverDetails: trip.driver, shareTrackingUrl: trip.trackingUrl } });
    }
    return res.json(trip);
});
router.post('/safety/trigger-sos', (req, res) => res.json({ dispatched: true, channels: ['SMS', 'Call'], latitude: bodyNumber(req.body.latitude), longitude: bodyNumber(req.body.longitude) }));
router.get('/chat/:poolId', async (req, res) => {
    if (db_1.prisma)
        return res.json(await db_1.prisma.chatMessage.findMany({ where: { poolId: req.params.poolId }, orderBy: { timestamp: 'asc' }, include: { user: true } }));
    return res.json(mockStore_1.mockStore.chatMessages.filter((message) => message.poolId === req.params.poolId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
});
router.post('/chat/:poolId', async (req, res) => {
    const data = { poolId: req.params.poolId, userId: bodyString(req.body.userId), text: bodyString(req.body.text) };
    if (!data.userId || !data.text)
        return res.status(400).json({ error: 'Message and user are required.' });
    if (db_1.prisma)
        return res.status(201).json(await db_1.prisma.chatMessage.create({ data }));
    const message = { ...data, id: mockStore_1.mockStore.nextId(), timestamp: new Date() };
    mockStore_1.mockStore.chatMessages.push(message);
    return res.status(201).json(message);
});
exports.default = router;
//# sourceMappingURL=routes.js.map