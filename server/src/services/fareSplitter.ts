import type { PrismaClient } from '@prisma/client'

export type FareDistance = { riderId: string; distanceKm: number }
export type FareShare = FareDistance & { individualFare: number }

/** Allocates the base fare in proportion to each rider's ordered route distance. */
export function calculateDistanceWeightedFares(baseFare: number, distances: FareDistance[]): FareShare[] {
  if (distances.length === 0) return []
  const safeFare = Math.max(0, baseFare)
  const safeDistances = distances.map((item) => ({ ...item, distanceKm: Math.max(0, item.distanceKm) }))
  const totalDistance = safeDistances.reduce((sum, item) => sum + item.distanceKm, 0)
  const equalShare = safeFare / safeDistances.length
  const shares = safeDistances.map((item) => ({
    ...item,
    individualFare: totalDistance === 0 ? equalShare : safeFare * (item.distanceKm / totalDistance),
  }))
  const rounded = shares.map((item) => ({ ...item, individualFare: Math.round(item.individualFare * 100) / 100 }))
  const correction = Math.round((safeFare - rounded.reduce((sum, item) => sum + item.individualFare, 0)) * 100) / 100
  rounded[rounded.length - 1].individualFare = Math.max(0, Math.round((rounded[rounded.length - 1].individualFare + correction) * 100) / 100)
  return rounded
}

/** Persists the calculated shares to PoolMember rows in one logical operation. */
export async function updatePoolMemberFares(prisma: PrismaClient, poolId: string, baseFare: number, distances: FareDistance[]): Promise<FareShare[]> {
  const shares = calculateDistanceWeightedFares(baseFare, distances)
  await Promise.all(shares.map((share) => prisma.poolMember.updateMany({ where: { poolId, userId: share.riderId }, data: { individualFare: share.individualFare } })))
  return shares
}
