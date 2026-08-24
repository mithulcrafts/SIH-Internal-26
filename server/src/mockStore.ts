// In-memory mock store used ONLY when DATABASE_URL is not set, so the server
// can run in local browser preview (WebContainers) without a live Postgres.
// All production queries target the Prisma PostgreSQL client in db.ts.

export type VehicleType = 'AUTO_3' | 'CAB_4'
export type RideRequestStatus = 'PENDING' | 'MATCHED' | 'COMPLETED' | 'CANCELLED'
export type PoolStatus = 'OPEN' | 'FULL' | 'PAYMENT_PENDING' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED'
export type PaymentStatus = 'PENDING' | 'PAID'

export interface MockUser {
  id: string
  email: string
  name: string
  rollNumber: string | null
  emergencyContact: string | null
  createdAt: Date
}

export interface MockRideRequest {
  id: string
  userId: string
  pickupLocationName: string
  dropoffLocationName: string
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  flexTimeStart: Date
  flexTimeEnd: Date
  vehicleType: VehicleType
  status: RideRequestStatus
  createdAt: Date
}

export interface MockPool {
  id: string
  vehicleType: VehicleType
  maxCapacity: number
  status: PoolStatus
  totalEstimatedFare: number
  driverDetails: Record<string, unknown> | null
  shareTrackingUrl: string | null
  createdAt: Date
}

export interface MockPoolMember {
  id: string
  poolId: string
  userId: string
  stopSequence: number
  individualFare: number
  paymentStatus: PaymentStatus
  paymentId: string | null
  createdAt: Date
}

export interface MockChatMessage {
  id: string
  poolId: string
  userId: string
  text: string
  timestamp: Date
}

const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const mockStore = {
  users: [] as MockUser[],
  rideRequests: [] as MockRideRequest[],
  pools: [] as MockPool[],
  poolMembers: [] as MockPoolMember[],
  chatMessages: [] as MockChatMessage[],
  nextId: uid,
}
