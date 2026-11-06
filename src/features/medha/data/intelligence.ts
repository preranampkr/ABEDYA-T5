import type { SanketReport, SanketUrgency } from '../../sanket/types'

export type MedhaPriority = 'critical' | 'high' | 'medium' | 'low'
export type MedhaDuplicateDecision = 'flagged' | 'confirmed' | 'rejected'

export interface PriorityFactor {
  key: string
  label: string
  points: number
  explanation: string
}

export interface PriorityAssessment {
  priority: MedhaPriority
  score: number
  confidence: number
  factors: PriorityFactor[]
  unknownFactors: string[]
  assessedAt: string
  algorithmVersion: 'medha-rules-v1'
}

export interface DuplicateCandidate {
  firstReportId: string
  secondReportId: string
  similarity: number
  reasons: string[]
}

const urgencyPoints: Record<SanketUrgency, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1,
}

const assistancePoints: Record<string, number> = {
  rescue: 2,
  medical: 2,
  evacuation: 2,
  shelter: 1,
  transport: 1,
  food_water: 1,
  other: 0,
}

const stopWords = new Set([
  'about', 'after', 'along', 'also', 'and', 'area', 'around', 'been', 'from',
  'have', 'near', 'people', 'that', 'the', 'there', 'this', 'with',
])

function normalizedText(report: SanketReport) {
  return `${report.summary} ${report.details}`.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

function textSimilarity(left: SanketReport, right: SanketReport) {
  const leftWords = new Set(normalizedText(left).filter((word) => word.length > 2 && !stopWords.has(word)))
  const rightWords = new Set(normalizedText(right).filter((word) => word.length > 2 && !stopWords.has(word)))
  if (!leftWords.size || !rightWords.size) return 0
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length
  const union = new Set([...leftWords, ...rightWords]).size
  return intersection / union
}

function distanceKm(left: SanketReport, right: SanketReport) {
  const a = left.location
  const b = right.location
  if (
    a.latitude === undefined || a.longitude === undefined ||
    b.latitude === undefined || b.longitude === undefined ||
    !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)
  ) return null

  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(b.latitude - a.latitude)
  const longitudeDelta = radians(b.longitude - a.longitude)
  const arc = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
}

function sameLocation(left: SanketReport, right: SanketReport) {
  const locality = left.location.locality.trim().toLowerCase()
  const otherLocality = right.location.locality.trim().toLowerCase()
  if (locality && locality === otherLocality) return 'same locality'
  const taluk = left.location.taluk.trim().toLowerCase()
  const otherTaluk = right.location.taluk.trim().toLowerCase()
  if (taluk && taluk === otherTaluk) return 'same taluk'
  return null
}

function withinHours(left: SanketReport, right: SanketReport, hours: number) {
  const leftTime = Date.parse(left.createdAt)
  const rightTime = Date.parse(right.createdAt)
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) &&
    Math.abs(leftTime - rightTime) <= hours * 60 * 60 * 1000
}

export function detectDuplicateCandidates(reports: SanketReport[]): DuplicateCandidate[] {
  const ordered = [...reports].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const candidates: DuplicateCandidate[] = []

  for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
    const first = ordered[firstIndex]
    const firstTime = Date.parse(first.createdAt)
    if (!Number.isFinite(firstTime)) continue

    for (let secondIndex = firstIndex + 1; secondIndex < ordered.length; secondIndex += 1) {
      const second = ordered[secondIndex]
      if (first.originKind !== second.originKind) continue
      const secondTime = Date.parse(second.createdAt)
      if (!Number.isFinite(secondTime)) continue
      if (secondTime - firstTime > 72 * 60 * 60 * 1000) break

      const descriptionSimilarity = textSimilarity(first, second)
      const distance = distanceKm(first, second)
      const locationMatch = sameLocation(first, second)
      const reasons: string[] = []
      let score = 0

      if (descriptionSimilarity >= 0.18) {
        score += Math.min(descriptionSimilarity, 0.6) * 0.5
        reasons.push(`Descriptions share ${Math.round(descriptionSimilarity * 100)}% of key terms`)
      }
      if (distance !== null && distance <= 5) {
        score += distance <= 1 ? 0.3 : distance <= 2 ? 0.22 : 0.12
        reasons.push(`Reported coordinates are ${distance.toFixed(1)} km apart`)
      } else if (locationMatch === 'same locality') {
        score += 0.22
        reasons.push('Reports name the same locality')
      } else if (locationMatch === 'same taluk') {
        score += 0.08
        reasons.push('Reports name the same taluk')
      }
      if (first.category === second.category) {
        score += 0.15
        reasons.push(`Same incident category: ${first.category.replace(/_/g, ' ')}`)
      }
      if (first.reportType === second.reportType) {
        score += 0.08
        reasons.push(`Same report type: ${first.reportType.toUpperCase()}`)
      }
      if (withinHours(first, second, 24)) {
        score += 0.15
        reasons.push('Submitted within 24 hours of each other')
      } else if (withinHours(first, second, 72)) {
        score += 0.08
        reasons.push('Submitted within 72 hours of each other')
      }

      const hasDescriptionOrPreciseLocation = descriptionSimilarity >= 0.18 || (distance !== null && distance <= 2)
      const hasSameCategoryOrType = first.category === second.category || first.reportType === second.reportType
      if (score >= 0.5 && hasDescriptionOrPreciseLocation && hasSameCategoryOrType) {
        const [firstReportId, secondReportId] = [first.id, second.id].sort()
        candidates.push({
          firstReportId,
          secondReportId,
          similarity: Math.round(Math.min(score, 1) * 100),
          reasons,
        })
      }
    }
  }

  return candidates.sort((a, b) => b.similarity - a.similarity)
}

export function assessPriority(report: SanketReport, now = Date.now()): PriorityAssessment {
  const factors: PriorityFactor[] = []
  const urgency = urgencyPoints[report.urgency]
  factors.push({
    key: 'reported-urgency',
    label: `Reporter-selected urgency: ${report.urgency}`,
    points: urgency,
    explanation: 'Self-reported urgency is included as a signal, not independently verified.',
  })

  if (report.reportType === 'sos') {
    factors.push({ key: 'sos', label: 'SOS report', points: 2, explanation: 'An SOS request indicates an immediate assistance request.' })
  } else if (report.reportType === 'assistance') {
    factors.push({ key: 'assistance', label: 'Assistance request', points: 1, explanation: 'A request for assistance contributes to the review score.' })
  }

  const assistancePointsTotal = report.assistanceNeeds.reduce((total, need) => total + (assistancePoints[need] ?? 0), 0)
  if (assistancePointsTotal > 0) {
    const points = Math.min(assistancePointsTotal, 4)
    factors.push({
      key: 'assistance-needs',
      label: 'Critical assistance needs reported',
      points,
      explanation: `${report.assistanceNeeds.map((need) => need.replace(/_/g, ' ')).join(', ')} were selected in the report.`,
    })
  }

  const impacts = report.reportedImpacts
  if (impacts.reportedInjuries !== null && impacts.reportedInjuries > 0) {
    factors.push({ key: 'injuries', label: `${impacts.reportedInjuries} reported injuries`, points: 4, explanation: 'Injuries were explicitly reported in the submitted report.' })
  }
  if (impacts.peopleTrapped !== null && impacts.peopleTrapped > 0) {
    factors.push({ key: 'trapped', label: `${impacts.peopleTrapped} people reported trapped`, points: 5, explanation: 'People trapped were explicitly reported in the submitted report.' })
  }
  if (impacts.vulnerablePeople !== null && impacts.vulnerablePeople > 0) {
    factors.push({ key: 'vulnerable-people', label: `${impacts.vulnerablePeople} vulnerable people reported`, points: 3, explanation: 'Vulnerable people were explicitly reported in the submitted report.' })
  }
  if (impacts.peopleAffected !== null && impacts.peopleAffected > 0) {
    factors.push({
      key: 'people-affected',
      label: `${impacts.peopleAffected} people affected`,
      points: Math.min(3, Math.ceil(impacts.peopleAffected / 10)),
      explanation: 'Affected-person count was explicitly reported in the submitted report.',
    })
  }

  if (report.verificationStatus !== 'verified') {
    factors.push({
      key: 'verification',
      label: `Report is ${report.verificationStatus}`,
      points: 0,
      explanation: 'Verification status reduces confidence and requires human review; it does not lower reported risk.',
    })
  }

  const createdAt = Date.parse(report.createdAt)
  const elapsedHours = Number.isFinite(createdAt) ? Math.max(0, (now - createdAt) / 3_600_000) : null
  if (elapsedHours !== null && report.status !== 'resolved' && report.status !== 'closed' && elapsedHours >= 6) {
    const points = elapsedHours >= 24 ? 2 : 1
    factors.push({
      key: 'unresolved-age',
      label: `Unresolved for ${Math.floor(elapsedHours)} hours`,
      points,
      explanation: 'Time since submission is a review signal; it does not change SANKET status.',
    })
  }

  const score = factors.reduce((total, factor) => total + factor.points, 0)
  const priority: MedhaPriority = score >= 15 ? 'critical' : score >= 10 ? 'high' : score >= 6 ? 'medium' : 'low'
  const unknownFactors = [
    impacts.peopleAffected === null ? 'Number of people affected' : null,
    impacts.reportedInjuries === null ? 'Reported injuries' : null,
    impacts.vulnerablePeople === null ? 'Vulnerable people' : null,
    impacts.peopleTrapped === null ? 'People trapped' : null,
  ].filter((value): value is string => value !== null)
  const hasCoordinates = report.location.latitude !== undefined && report.location.longitude !== undefined
  const confidence = Math.max(
    20,
    Math.round(100 - (unknownFactors.length * 8) - (report.verificationStatus === 'verified' ? 0 : 15) - (hasCoordinates ? 0 : 10)),
  )

  return {
    priority,
    score,
    confidence,
    factors,
    unknownFactors,
    assessedAt: new Date(now).toISOString(),
    algorithmVersion: 'medha-rules-v1',
  }
}

export function formatPriority(priority: MedhaPriority) {
  return priority[0].toUpperCase() + priority.slice(1)
}
