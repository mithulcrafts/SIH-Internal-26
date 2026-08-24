// Frontend Google Maps adapter.
// When VITE_GOOGLE_MAPS_API_KEY is set, calls real Places Autocomplete,
// Geocoding, and Directions APIs. Otherwise falls back to mock data
// built from the hardcoded campus + Gwalior coordinates.

export type GeoLocation = { name: string; lat: number; lng: number }

const API_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined

export const isGoogleMapsEnabled = (): boolean => Boolean(API_KEY)

/** Places Autocomplete using MapTiler Geocoding API */
export async function searchPlaces(query: string): Promise<GeoLocation[]> {
  const localResults = mockSearch(query)
  if (!API_KEY) return localResults
  try {
    const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${API_KEY}&proximity=78.170,26.246&country=IN`)
    const data = await res.json()
    const apiResults = (data.features || []).map((f: any) => ({
      name: f.place_name || f.text,
      lat: f.center[1],
      lng: f.center[0],
      placeId: f.id,
    }))
    
    // Combine local results (prioritized) with API results, filtering out exact name duplicates
    const combined = [...localResults]
    apiResults.forEach((apiRes: GeoLocation) => {
      if (!combined.some((r) => r.name === apiRes.name)) {
        combined.push(apiRes)
      }
    })
    return combined
  } catch {
    return localResults
  }
}

/** Geocoding — resolves a place name to lat/lng. */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) return mockGeocode(address)
  try {
    const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${API_KEY}`)
    const data = await res.json()
    const loc = data.features?.[0]?.center
    return loc ? { lat: loc[1], lng: loc[0] } : null
  } catch {
    return mockGeocode(address)
  }
}

/** Reverse Geocoding — resolves a lat/lng to a place name. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!API_KEY) return 'Custom destination'
  try {
    const res = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${API_KEY}`)
    const data = await res.json()
    return data.features?.[0]?.text || data.features?.[0]?.place_name || null
  } catch {
    return 'Custom destination'
  }
}

/** Directions with TSP waypoint optimization (Mock only for now). */
export async function optimizeRoute(waypoints: GeoLocation[]): Promise<GeoLocation[]> {
  return waypoints // Kept simple as MapTiler directions is a separate API
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
