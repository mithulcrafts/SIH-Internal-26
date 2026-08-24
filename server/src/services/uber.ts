// Server-side Uber for Business / Sandbox adapter.
// Manages OAuth 2.0 client credentials tokens and provides methods
// to dispatch sandbox trips and receive webhook events.
// Falls back to mock driver data when credentials are absent.

const CLIENT_ID = process.env.UBER_CLIENT_ID
const CLIENT_SECRET = process.env.UBER_CLIENT_SECRET
const SANDBOX_BASE = 'https://sandbox-api.uber.com/v1'

let cachedToken: { value: string; expiresAt: number } | null = null

export const isUberEnabled = (): boolean => Boolean(CLIENT_ID && CLIENT_SECRET)

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
}): Promise<{ driver: Record<string, unknown>; trackingUrl: string }> {
  const mockDriver = {
    name: 'Ramesh Sharma',
    vehicle: 'White Swift Dzire',
    vehicleNumber: 'MP-07-AB-1234',
    phone: '+91 98765 43210',
    rating: 4.8,
  }

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
