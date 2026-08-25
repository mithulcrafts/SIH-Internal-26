// Server-side Uber for Business / Sandbox adapter.
// Manages OAuth 2.0 client credentials tokens and provides methods
// to dispatch sandbox trips and receive webhook events.
// Falls back to mock driver data when credentials are absent.

const CLIENT_ID = process.env.UBER_CLIENT_ID
const CLIENT_SECRET = process.env.UBER_CLIENT_SECRET
const SANDBOX_BASE = 'https://sandbox-api.uber.com/v1'

let cachedToken: { value: string; expiresAt: number } | null = null

export const isUberEnabled = (): boolean => Boolean(CLIENT_ID && CLIENT_SECRET)

const MOCK_AUTO_DRIVERS = [
  { id: 'drv-auto-1', name: 'Ramesh Sharma', vehicle: 'Bajaj RE Auto', vehicleNumber: 'MP-07-AB-1234', phone: '+91 98765 43210', rating: 4.8, eta: 4, trips: 1283 },
  { id: 'drv-auto-2', name: 'Suresh Kumar', vehicle: 'TVS King Auto', vehicleNumber: 'MP-07-CD-5678', phone: '+91 91234 56789', rating: 4.9, eta: 6, trips: 2104 },
  { id: 'drv-auto-3', name: 'Dinesh Yadav', vehicle: 'Bajaj RE Auto', vehicleNumber: 'MP-07-JK-7890', phone: '+91 93456 78901', rating: 4.6, eta: 3, trips: 876 },
  { id: 'drv-auto-4', name: 'Mahesh Verma', vehicle: 'Piaggio Ape Auto', vehicleNumber: 'MP-07-LM-2345', phone: '+91 94567 89012', rating: 4.7, eta: 8, trips: 1547 },
]

const MOCK_CAB_DRIVERS = [
  { id: 'drv-cab-1', name: 'Vikram Singh', vehicle: 'White Swift Dzire', vehicleNumber: 'MP-07-EF-9012', phone: '+91 99887 76655', rating: 4.7, eta: 5, trips: 3201 },
  { id: 'drv-cab-2', name: 'Amit Patel', vehicle: 'White Maruti WagonR', vehicleNumber: 'MP-07-GH-3456', phone: '+91 98765 12345', rating: 4.9, eta: 7, trips: 4567 },
  { id: 'drv-cab-3', name: 'Rajesh Tiwari', vehicle: 'Silver Honda Amaze', vehicleNumber: 'MP-07-NP-6789', phone: '+91 95678 90123', rating: 4.5, eta: 4, trips: 2890 },
  { id: 'drv-cab-4', name: 'Karan Malhotra', vehicle: 'White Hyundai Xcent', vehicleNumber: 'MP-07-QR-0123', phone: '+91 96789 01234', rating: 4.8, eta: 9, trips: 1932 },
]

/** Return the full list of mock drivers for a vehicle type. */
export function getMockDrivers(vehicleType: string) {
  return vehicleType === 'AUTO_3' ? MOCK_AUTO_DRIVERS : MOCK_CAB_DRIVERS
}

/** Obtain (or return cached) OAuth 2.0 client credentials token. */
export async function getAccessToken(): Promise<string | null> {
  if (!isUberEnabled()) return null
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  try {
    const res = await fetch(`${SANDBOX_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        scope: 'guests.trips',
      }),
    })
    const data = await res.json() as { access_token: string; expires_in: number }
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    }
    return cachedToken.value
  } catch {
    return null
  }
}

/** Dispatch a sandbox trip. Returns mock driver when not configured. */
export async function dispatchTrip(params: {
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  vehicleType?: string
}): Promise<{ driver: Record<string, unknown>; trackingUrl: string }> {
  const driverList = params.vehicleType === 'AUTO_3' ? MOCK_AUTO_DRIVERS : MOCK_CAB_DRIVERS
  const mockDriver = driverList[Math.floor(Math.random() * driverList.length)]

  if (!isUberEnabled()) {
    return { driver: mockDriver, trackingUrl: `/track/mock_${Date.now()}` }
  }

  const token = await getAccessToken()
  if (!token) return { driver: mockDriver, trackingUrl: `/track/mock_${Date.now()}` }

  try {
    const res = await fetch(`${SANDBOX_BASE}/guests/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pickup: { latitude: params.pickupLat, longitude: params.pickupLng },
        destination: { latitude: params.dropoffLat, longitude: params.dropoffLng },
      }),
    })
    const data = await res.json() as { driver?: Record<string, unknown>; tracking_url?: string; id?: string }
    return {
      driver: { ...mockDriver, ...data.driver },
      trackingUrl: data.tracking_url || `/track/${data.id}`,
    }
  } catch {
    return { driver: mockDriver, trackingUrl: `/track/mock_${Date.now()}` }
  }
}

/** Simulate a sandbox trip status change (ACCEPT, ARRIVED, BEGIN_TRIP, DROPOFF). */
export async function simulateStatus(tripId: string, status: string): Promise<boolean> {
  if (!isUberEnabled()) return true
  const token = await getAccessToken()
  if (!token) return false

  try {
    const res = await fetch(`${SANDBOX_BASE}/guests/sandbox/trips/${tripId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Parse a webhook payload — returns the event type and trip ID. */
export function parseWebhook(body: unknown): { eventType: string; tripId: string } {
  const data = body as { event_type: string; meta: { resource_id: string } }
  return {
    eventType: data?.event_type || 'unknown',
    tripId: data?.meta?.resource_id || '',
  }
}
