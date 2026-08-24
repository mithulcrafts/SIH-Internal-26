import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from './db'
import { mockStore, type MockPool, type MockRideRequest } from './mockStore'
import { clusterRideRequests, type GroupingVehicleType, type RideCandidate } from './services/groupingEngine'
import { calculateDistanceWeightedFares, updatePoolMemberFares } from './services/fareSplitter'
import { optimizeRoute } from './services/routeOptimizer'
import { createOrder, verifySignature } from './services/razorpay'
import { dispatchTrip } from './services/uber'

const router = Router()
const jwtSecret = process.env.JWT_SECRET || 'development-only-secret'

const createToken = (userId: string): string => jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' })
const bodyString = (value: unknown): string => typeof value === 'string' ? value : ''
const bodyNumber = (value: unknown): number => typeof value === 'number' ? value : Number(value)
const validIiitmEmail = (email: string): boolean => /^[^@\s]+@iiitm\.ac\.in$/i.test(email)
const capacityFor = (vehicleType: GroupingVehicleType): number => vehicleType === 'CAB_4' ? 4 : 3
const fareFor = (vehicleType: GroupingVehicleType): number => vehicleType === 'CAB_4' ? 276 : 204

async function matchPendingRides(vehicleType: GroupingVehicleType, requireMultiple = false): Promise<{ pool: unknown; matchedRiders: number } | null> {
  if (prisma) {
    const pending = await prisma.rideRequest.findMany({ where: { status: 'PENDING', vehicleType }, orderBy: { createdAt: 'asc' }, take: capacityFor(vehicleType) })
    const cluster = clusterRideRequests(pending.map(toRideCandidate), vehicleType)[0]
    if (!cluster || (requireMultiple && cluster.rides.length < 2)) return null
    const pool = await prisma.pool.create({ data: { vehicleType, maxCapacity: cluster.capacity, status: cluster.rides.length >= cluster.capacity ? 'FULL' : 'OPEN', totalEstimatedFare: fareFor(vehicleType) } })
    await prisma.poolMember.createMany({ data: cluster.rides.map((ride, index) => ({ poolId: pool.id, userId: ride.userId, stopSequence: index + 1 })) })
    await prisma.rideRequest.updateMany({ where: { id: { in: cluster.rides.map((ride) => ride.id) } }, data: { status: 'MATCHED' } })
    return { pool, matchedRiders: cluster.rides.length }
  }

  const pending = mockStore.rideRequests.filter((ride) => ride.status === 'PENDING' && ride.vehicleType === vehicleType).slice(0, capacityFor(vehicleType))
  const cluster = clusterRideRequests(pending, vehicleType)[0]
  if (!cluster || (requireMultiple && cluster.rides.length < 2)) return null
  const pool: MockPool = { id: mockStore.nextId(), vehicleType, maxCapacity: cluster.capacity, status: cluster.rides.length >= cluster.capacity ? 'FULL' : 'OPEN', totalEstimatedFare: fareFor(vehicleType), driverDetails: null, shareTrackingUrl: null, createdAt: new Date() }
  mockStore.pools.push(pool)
  cluster.rides.forEach((ride, index) => {
    const mockRide = mockStore.rideRequests.find((r) => r.id === ride.id)
    if (mockRide) mockRide.status = 'MATCHED'
    mockStore.poolMembers.push({ id: mockStore.nextId(), poolId: pool.id, userId: ride.userId, stopSequence: index + 1, individualFare: 0, paymentStatus: 'PENDING', paymentId: null, createdAt: new Date() })
  })
  return { pool, matchedRiders: cluster.rides.length }
}

function toRideCandidate(ride: { id: string; userId: string; pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; flexTimeStart: Date; flexTimeEnd: Date; vehicleType: GroupingVehicleType }): RideCandidate {
  return { id: ride.id, userId: ride.userId, pickupLat: ride.pickupLat, pickupLng: ride.pickupLng, dropoffLat: ride.dropoffLat, dropoffLng: ride.dropoffLng, flexTimeStart: ride.flexTimeStart, flexTimeEnd: ride.flexTimeEnd, vehicleType: ride.vehicleType }
}

router.post('/auth/send-otp', (req: Request, res: Response) => {
  const email = bodyString(req.body.email).toLowerCase()
  if (!validIiitmEmail(email)) return res.status(400).json({ error: 'Use an @iiitm.ac.in email address.' })
  return res.json({ sent: true, expiresInSeconds: 300 })
})

router.post('/auth/verify-otp', async (req: Request, res: Response) => {
  const email = bodyString(req.body.email).toLowerCase()
  const otp = bodyString(req.body.otp)
  if (!validIiitmEmail(email) || otp !== '123456') return res.status(401).json({ error: 'Invalid verification code.' })

  if (prisma) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split('@')[0] },
    })
    return res.json({ token: createToken(user.id), user })
  }

  let user = mockStore.users.find((candidate) => candidate.email === email)
  if (!user) {
    user = { id: mockStore.nextId(), email, name: email.split('@')[0], rollNumber: null, emergencyContact: null, createdAt: new Date() }
    mockStore.users.push(user)
  }
  return res.json({ token: createToken(user.id), user })
})

router.post('/rides/request', async (req: Request, res: Response) => {
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
    vehicleType: req.body.vehicleType === 'CAB_4' ? 'CAB_4' as const : 'AUTO_3' as const,
  }

  if (prisma) {
    const ride = await prisma.rideRequest.create({ data: payload })
    await matchPendingRides(payload.vehicleType, true)
    return res.status(201).json(ride)
  }

  const ride: MockRideRequest = { ...payload, id: mockStore.nextId(), status: 'PENDING', createdAt: new Date() }
  mockStore.rideRequests.push(ride)
  await matchPendingRides(payload.vehicleType, true)
  return res.status(201).json(ride)
})

router.post('/pools/match', async (req: Request, res: Response) => {
  const vehicleType = req.body.vehicleType === 'CAB_4' ? 'CAB_4' as const : 'AUTO_3' as const
  const result = await matchPendingRides(vehicleType)
  if (!result) return res.status(200).json({ pool: null, matchedRiders: 0, message: 'No compatible pending rides found.' })
  return res.status(201).json(result)
})

router.post('/pools/:id/sequence', async (req: Request, res: Response) => {
  const waypoints = Array.isArray(req.body.waypoints) ? req.body.waypoints : []
  if (waypoints.length > 1) {
    const route = await optimizeRoute({ origin: req.body.origin, waypoints, destination: req.body.destination })
    return res.json({ poolId: req.params.id, ...route, etaMinutes: Math.ceil(route.totalDistanceKm * 3) })
  }
  if (prisma) {
    const members = await prisma.poolMember.findMany({ where: { poolId: req.params.id }, orderBy: { stopSequence: 'asc' }, include: { user: true } })
    return res.json({ poolId: req.params.id, stops: members, totalDistanceKm: 0, provider: 'mock', etaMinutes: 25 })
  }
  const members = mockStore.poolMembers.filter((member) => member.poolId === req.params.id).sort((a, b) => a.stopSequence - b.stopSequence)
  return res.json({ poolId: req.params.id, stops: members, totalDistanceKm: 0, provider: 'mock', etaMinutes: 25 })
})

router.post('/pools/:id/split', async (req: Request, res: Response) => {
  const totalFare = bodyNumber(req.body.totalFare) || 204
  const distances = Array.isArray(req.body.distances) ? req.body.distances as Array<{ riderId?: string; distanceKm?: number }> : []
  if (prisma) {
    const members = await prisma.poolMember.findMany({ where: { poolId: req.params.id }, orderBy: { stopSequence: 'asc' } })
    const fareDistances = members.map((member) => ({ riderId: member.userId, distanceKm: Number(distances.find((item) => item.riderId === member.userId)?.distanceKm) || 0 }))
    const shares = await updatePoolMemberFares(prisma, req.params.id, totalFare, fareDistances)
    return res.json({ shares })
  }
  const members = mockStore.poolMembers.filter((member) => member.poolId === req.params.id).sort((a, b) => a.stopSequence - b.stopSequence)
  const fareDistances = members.map((member) => ({ riderId: member.userId, distanceKm: Number(distances.find((item) => item.riderId === member.userId)?.distanceKm) || 0 }))
  const shares = calculateDistanceWeightedFares(totalFare, fareDistances)
  members.forEach((member) => { member.individualFare = shares.find((share) => share.riderId === member.userId)?.individualFare || 0 })
  return res.json({ shares })
})

router.post('/payments/mock-order', async (req: Request, res: Response) => {
  const order = await createOrder(bodyNumber(req.body.amount), 'INR')
  return res.status(201).json({ ...order, currency: 'INR' })
})
router.post('/payments/verify', (req: Request, res: Response) => {
  const orderId = bodyString(req.body.orderId)
  const paymentId = bodyString(req.body.paymentId)
  const signature = bodyString(req.body.signature)
  if (orderId && paymentId && signature && !verifySignature({ orderId, paymentId, signature })) return res.status(400).json({ verified: false, error: 'Invalid payment signature' })
  return res.json({ verified: true, paymentId: paymentId || `pay_demo_${mockStore.nextId()}` })
})
router.post('/uber/mock-dispatch', async (req: Request, res: Response) => {
  const trip = await dispatchTrip({ pickupLat: bodyNumber(req.body.pickupLat), pickupLng: bodyNumber(req.body.pickupLng), dropoffLat: bodyNumber(req.body.dropoffLat), dropoffLng: bodyNumber(req.body.dropoffLng) })
  if (prisma && bodyString(req.body.poolId)) {
    await prisma.pool.update({ where: { id: bodyString(req.body.poolId) }, data: { status: 'DISPATCHED', driverDetails: trip.driver as import('@prisma/client').Prisma.InputJsonValue, shareTrackingUrl: trip.trackingUrl } })
  }
  return res.json(trip)
})
router.post('/safety/trigger-sos', (req: Request, res: Response) => res.json({ dispatched: true, channels: ['SMS', 'Call'], latitude: bodyNumber(req.body.latitude), longitude: bodyNumber(req.body.longitude) }))

router.get('/chat/:poolId', async (req: Request, res: Response) => {
  if (prisma) return res.json(await prisma.chatMessage.findMany({ where: { poolId: req.params.poolId }, orderBy: { timestamp: 'asc' }, include: { user: true } }))
  return res.json(mockStore.chatMessages.filter((message) => message.poolId === req.params.poolId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()))
})
router.post('/chat/:poolId', async (req: Request, res: Response) => {
  const data = { poolId: req.params.poolId, userId: bodyString(req.body.userId), text: bodyString(req.body.text) }
  if (!data.userId || !data.text) return res.status(400).json({ error: 'Message and user are required.' })
  if (prisma) return res.status(201).json(await prisma.chatMessage.create({ data }))
  const message = { ...data, id: mockStore.nextId(), timestamp: new Date() }
  mockStore.chatMessages.push(message)
  return res.status(201).json(message)
})

export default router
