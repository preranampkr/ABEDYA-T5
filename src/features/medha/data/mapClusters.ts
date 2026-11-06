import type { SanketReport } from '../../sanket/types'

const clusterDistanceKm = 1.5

function haversineKm(left: SanketReport, right: SanketReport) {
  const leftLat = left.location.latitude
  const leftLon = left.location.longitude
  const rightLat = right.location.latitude
  const rightLon = right.location.longitude
  if (
    leftLat === undefined || leftLon === undefined ||
    rightLat === undefined || rightLon === undefined
  ) return Number.POSITIVE_INFINITY

  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(rightLat - leftLat)
  const longitudeDelta = radians(rightLon - leftLon)
  const arc = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(leftLat)) * Math.cos(radians(rightLat)) *
    Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
}

export function clusterLocatedReports<TReport extends SanketReport>(reports: TReport[]) {
  const located = reports.filter((report) =>
    Number.isFinite(report.location.latitude) &&
    Number.isFinite(report.location.longitude),
  )
  const parent = located.map((_, index) => index)

  function find(index: number): number {
    if (parent[index] !== index) parent[index] = find(parent[index])
    return parent[index]
  }

  for (let first = 0; first < located.length; first += 1) {
    for (let second = first + 1; second < located.length; second += 1) {
      if (haversineKm(located[first], located[second]) > clusterDistanceKm) continue
      const firstRoot = find(first)
      const secondRoot = find(second)
      if (firstRoot !== secondRoot) parent[secondRoot] = firstRoot
    }
  }

  const groups = new Map<number, TReport[]>()
  located.forEach((report, index) => {
    const root = find(index)
    groups.set(root, [...(groups.get(root) ?? []), report])
  })
  return [...groups.values()]
}
