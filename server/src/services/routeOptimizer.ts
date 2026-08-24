import { USE_LIVE_GOOGLE_MAPS } from '../config'
import { haversine } from './groupingEngine'

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json'
const API_KEY = process.env.GOOGLE_MAPS_API_KEY

export type Waypoint = {
  id?: string
  riderId?: string
  name: string
  lat: number
  lng: number
  type?: 'PICKUP' | 'DROPOFF' | 'ORIGIN' | 'DESTINATION'
}

export type OrderedStop = Waypoint & {
  stopSequence: number
  distanceFromPreviousKm: number
  cumulativeDistanceKm: number
}

export type RouteOptimizationResult = {
  stops: OrderedStop[]
  totalDistanceKm: number
  provider: 'google' | 'mock'
  googleWaypointOrder?: number[]
}

/** Orders every pickup and dropoff, returning explicit sequence and leg distances. */
export async function optimizeRoute(params: { origin?: Waypoint; waypoints: Waypoint[]; destination?: Waypoint }): Promise<RouteOptimizationResult> {
  const origin = params.origin || params.waypoints[0]
  const destination = params.destination || params.waypoints[params.waypoints.length - 1] || origin
  const middle = params.waypoints.filter((waypoint) => waypoint !== origin && waypoint !== destination)
  if (!origin || !destination) return { stops: [], totalDistanceKm: 0, provider: 'mock' }

  if (USE_LIVE_GOOGLE_MAPS && API_KEY && middle.length > 0) {
    const liveResult = await optimizeWithGoogle(origin, middle, destination)
    if (liveResult) return liveResult
  }
  return optimizeWithNearestNeighbour(origin, middle, destination)
}

/** Backwards-compatible helper for callers that only need ordered waypoints. */
export async function optimizeWaypoints(waypoints: Waypoint[]): Promise<Waypoint[]> {
  if (waypoints.length <= 2) return waypoints
  const result = await optimizeRoute({ origin: waypoints[0], waypoints, destination: waypoints[waypoints.length - 1] })
  return result.stops.map(({ stopSequence: _sequence, distanceFromPreviousKm: _leg, cumulativeDistanceKm: _total, ...waypoint }) => waypoint)
}

async function optimizeWithGoogle(origin: Waypoint, middle: Waypoint[], destination: Waypoint): Promise<RouteOptimizationResult | null> {
  try {
    const waypointParam = `optimize:true|${middle.map((waypoint) => `${waypoint.lat},${waypoint.lng}`).join('|')}`
    const url = `${DIRECTIONS_URL}?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=${waypointParam}&key=${API_KEY}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json() as { routes?: Array<{ waypoint_order?: number[]; legs?: Array<{ distance?: { value?: number } }> }> }
    const route = data.routes?.[0]
    if (!route?.waypoint_order || !route.legs) return null
    const orderedWaypoints = [origin, ...route.waypoint_order.map((index) => middle[index]), destination]
    return buildResult(orderedWaypoints, route.legs.map((leg) => (leg.distance?.value || 0) / 1000), 'google', route.waypoint_order)
  } catch {
    return null
  }
}

function optimizeWithNearestNeighbour(origin: Waypoint, middle: Waypoint[], destination: Waypoint): RouteOptimizationResult {
  const remaining = [...middle]
  const ordered: Waypoint[] = [origin]
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1]
    const nearestIndex = remaining.reduce((winner, waypoint, index) => haversine(current.lat, current.lng, waypoint.lat, waypoint.lng) < haversine(current.lat, current.lng, remaining[winner].lat, remaining[winner].lng) ? index : winner, 0)
    ordered.push(remaining.splice(nearestIndex, 1)[0])
  }
  ordered.push(destination)
  return buildResult(ordered, [], 'mock')
}

function buildResult(ordered: Waypoint[], liveLegDistances: number[], provider: 'google' | 'mock', googleWaypointOrder?: number[]): RouteOptimizationResult {
  let cumulative = 0
  const stops = ordered.map((waypoint, index) => {
    const legDistance = index === 0 ? 0 : liveLegDistances[index - 1] || haversine(ordered[index - 1].lat, ordered[index - 1].lng, waypoint.lat, waypoint.lng)
    cumulative += legDistance
    return { ...waypoint, stopSequence: index + 1, distanceFromPreviousKm: round(legDistance), cumulativeDistanceKm: round(cumulative) }
  })
  return { stops, totalDistanceKm: round(cumulative), provider, googleWaypointOrder }
}

function round(value: number): number { return Math.round(value * 100) / 100 }
