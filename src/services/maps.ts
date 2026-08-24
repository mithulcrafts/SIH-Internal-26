// Frontend Google Maps adapter.
// When VITE_GOOGLE_MAPS_API_KEY is set, calls real Places Autocomplete,
// Geocoding, and Directions APIs. Otherwise falls back to mock data
// built from the hardcoded campus + Gwalior coordinates.

export type GeoLocation = { name: string; lat: number; lng: number }

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json'

export const isGoogleMapsEnabled = (): boolean => Boolean(API_KEY)

/** Places Autocomplete — returns typed location suggestions. */
export async function searchPlaces(query: string): Promise<GeoLocation[]> {
  if (!API_KEY) return mockSearch(query)
  try {
    const res = await fetch(`${GOOGLE_PLACES_URL}?input=${encodeURIComponent(query)}&key=${API_KEY}&components=country:in&location=26.246,78.170&radius=20000`)
    const data = await res.json()
    return (data.predictions || []).map((p: { description: string; place_id: string }) => ({
      name: p.description,
      lat: 0, lng: 0, placeId: p.place_id,
    } as GeoLocation & { placeId: string }))
  } catch {
    return mockSearch(query)
  }
}

/** Geocoding — resolves a place name to lat/lng. */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) return mockGeocode(address)
  try {
    const res = await fetch(`${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${API_KEY}`)
    const data = await res.json()
    const loc = data.results?.[0]?.geometry?.location
    return loc ? { lat: loc.lat, lng: loc.lng } : null
  } catch {
    return mockGeocode(address)
  }
}

/** Directions with TSP waypoint optimization (optimizeWaypoints: true). */
export async function optimizeRoute(waypoints: GeoLocation[]): Promise<GeoLocation[]> {
  if (!API_KEY || waypoints.length <= 2) return waypoints
  try {
    const origin = waypoints[0]
    const destination = waypoints[waypoints.length - 1]
    const intermediate = waypoints.slice(1, -1).map((w) => `${w.lat},${w.lng}`).join('|')
    const res = await fetch(
      `${GOOGLE_DIRECTIONS_URL}?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=optimize:true|${intermediate}&key=${API_KEY}`,
    )
    const data = await res.json()
    const order = data.routes?.[0]?.waypoint_order as number[] | undefined
    if (!order) return waypoints
    const middle = waypoints.slice(1, -1)
    return [origin, ...order.map((i) => middle[i]), destination]
  } catch {
    return waypoints
  }
}

// --- Mock fallbacks ---

const mockLocations: GeoLocation[] = [
  { name: 'Gwalior Railway Station', lat: 26.2183, lng: 78.1828 },
  { name: 'City Center / DD Mall', lat: 26.2052, lng: 78.1944 },
  { name: 'Maharaj Bada', lat: 26.2005, lng: 78.1589 },
  { name: 'Rajmata Vijayaraje Scindia Airport', lat: 26.2941, lng: 78.2272 },
  { name: 'MITS Gwalior', lat: 26.2634, lng: 78.2103 },
  { name: 'JIET Gwalior', lat: 26.2589, lng: 78.2015 },
]

function mockSearch(query: string): GeoLocation[] {
  const q = query.toLowerCase()
  return mockLocations.filter((l) => l.name.toLowerCase().includes(q))
}

function mockGeocode(address: string): { lat: number; lng: number } | null {
  const found = mockLocations.find((l) => l.name.toLowerCase().includes(address.toLowerCase()))
  return found ? { lat: found.lat, lng: found.lng } : null
}
