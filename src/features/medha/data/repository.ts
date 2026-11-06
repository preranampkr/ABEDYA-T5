import { isLocalPreviewEnabled } from '../../../lib/localPreview'
import { supabase } from '../../../lib/supabase'
import { reportStore } from '../../sanket/data/reportStore'
import { mapSanketReport } from '../../sanket/data/reportRepository'
import type { SanketReport } from '../../sanket/types'
import type {
  DuplicateCandidate,
  MedhaDuplicateDecision,
  MedhaPriority,
  PriorityAssessment,
} from './intelligence'
import { assessPriority } from './intelligence'

export type MedhaReviewAction = 'verified' | 'request_information'

export interface MedhaReviewEvent {
  id: string
  action: MedhaReviewAction | 'duplicate_flagged' | 'duplicate_confirmed' | 'duplicate_rejected' | 'priority_overridden'
  note: string
  at: string
  by: string
  relatedReportId?: string
}

export interface MedhaDuplicateRecord extends DuplicateCandidate {
  decision: MedhaDuplicateDecision
  reviewedAt?: string
  reviewedBy?: string
}

export interface MedhaIncident extends SanketReport {
  reviewHistory: MedhaReviewEvent[]
  duplicateMatches: MedhaDuplicateRecord[]
  storedAssessment: PriorityAssessment | null
  priorityOverride: {
    priority: MedhaPriority
    previousPriority: MedhaPriority | null
    reason: string
    at: string
    by: string
    reviewerId: string | null
  } | null
}

export interface MedhaPriorityProvenance {
  source: 'automated_assessment' | 'reviewer_override'
  priority: MedhaPriority
  previousPriority: MedhaPriority | null
  reviewerId: string | null
  reviewerName: string | null
  reason: string | null
  changedAt: string | null
  algorithmVersion: string
  assessedAt: string
}

export interface MedhaHandoffIncident {
  report: MedhaIncident
  statusHistory: SanketReport['assignmentHistory']
  priority: MedhaPriority
  priorityProvenance: MedhaPriorityProvenance
}

const localReviewHistory = new Map<string, MedhaReviewEvent[]>()
const localDuplicateRecords = new Map<string, MedhaDuplicateRecord>()
const localAssessments = new Map<string, PriorityAssessment>()
const localOverrides = new Map<string, MedhaIncident['priorityOverride']>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function mapReviewEvent(value: unknown): MedhaReviewEvent | null {
  if (!isRecord(value)) return null
  const action = text(value.action)
  const allowed: MedhaReviewEvent['action'][] = [
    'verified', 'request_information', 'duplicate_flagged', 'duplicate_confirmed',
    'duplicate_rejected', 'priority_overridden',
  ]
  if (!allowed.includes(action as MedhaReviewEvent['action'])) return null
  return {
    id: text(value.id, `${text(value.reportId)}-${text(value.at)}`),
    action: action as MedhaReviewEvent['action'],
    note: text(value.note),
    at: text(value.at),
    by: text(value.by, 'Reviewer'),
    relatedReportId: typeof value.relatedReportId === 'string' ? value.relatedReportId : undefined,
  }
}

function mapDuplicate(value: unknown): MedhaDuplicateRecord | null {
  if (!isRecord(value)) return null
  const decision = text(value.decision, 'flagged')
  if (!['flagged', 'confirmed', 'rejected'].includes(decision)) return null
  const reasons = array(value.reasons).filter((reason): reason is string => typeof reason === 'string')
  return {
    firstReportId: text(value.firstReportId),
    secondReportId: text(value.secondReportId),
    similarity: typeof value.similarity === 'number' ? Math.round(value.similarity * (value.similarity <= 1 ? 100 : 1)) : 0,
    reasons,
    decision: decision as MedhaDuplicateDecision,
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : undefined,
    reviewedBy: typeof value.reviewedBy === 'string' ? value.reviewedBy : undefined,
  }
}

function mapAssessment(value: unknown): PriorityAssessment | null {
  if (!isRecord(value)) return null
  const priority = text(value.priority)
  if (!['critical', 'high', 'medium', 'low'].includes(priority)) return null
  const confidence = typeof value.confidence === 'number' ? value.confidence : 0
  return {
    priority: priority as MedhaPriority,
    score: typeof value.score === 'number' ? value.score : 0,
    confidence: confidence <= 1 ? Math.round(confidence * 100) : confidence,
    factors: array(value.factors).filter(isRecord).map((factor) => ({
      key: text(factor.key),
      label: text(factor.label),
      points: typeof factor.points === 'number' ? factor.points : 0,
      explanation: text(factor.explanation),
    })),
    unknownFactors: array(value.unknownFactors).filter((item): item is string => typeof item === 'string'),
    assessedAt: text(value.assessedAt),
    algorithmVersion: 'medha-rules-v1',
  }
}

function localIncident(report: SanketReport): MedhaIncident {
  return {
    ...report,
    reviewHistory: localReviewHistory.get(report.id) ?? [],
    duplicateMatches: [...localDuplicateRecords.values()].filter(
      (match) => match.firstReportId === report.id || match.secondReportId === report.id,
    ),
    storedAssessment: localAssessments.get(report.id) ?? null,
    priorityOverride: localOverrides.get(report.id) ?? null,
  }
}

function mapPriorityProvenance(value: unknown): MedhaPriorityProvenance | null {
  if (!isRecord(value)) return null
  const priority = text(value.priority)
  const source = text(value.source)
  if (!['critical', 'high', 'medium', 'low'].includes(priority) ||
      !['automated_assessment', 'reviewer_override'].includes(source)) return null
  return {
    source: source as MedhaPriorityProvenance['source'],
    priority: priority as MedhaPriority,
    previousPriority: ['critical', 'high', 'medium', 'low'].includes(text(value.previousPriority))
      ? text(value.previousPriority) as MedhaPriority
      : null,
    reviewerId: typeof value.reviewerId === 'string' ? value.reviewerId : null,
    reviewerName: typeof value.reviewerName === 'string' ? value.reviewerName : null,
    reason: typeof value.reason === 'string' ? value.reason : null,
    changedAt: typeof value.changedAt === 'string' ? value.changedAt : null,
    algorithmVersion: text(value.algorithmVersion, 'medha-rules-v1'),
    assessedAt: text(value.assessedAt),
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function requireLocalPreview() {
  if (!isLocalPreviewEnabled()) throw new Error('MEDHA actions require an authenticated helper or local preview.')
}

function appendLocalReview(reportId: string, action: MedhaReviewEvent['action'], note: string, relatedReportId?: string) {
  const entry: MedhaReviewEvent = {
    id: `${reportId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    note,
    at: new Date().toISOString(),
    by: 'Local preview reviewer',
    relatedReportId,
  }
  localReviewHistory.set(reportId, [...(localReviewHistory.get(reportId) ?? []), entry])
}

export const medhaRepository = {
  async listIncidents(): Promise<MedhaIncident[]> {
    if (!supabase && isLocalPreviewEnabled()) return reportStore.getAll().map(localIncident)
    const client = requireSupabase()
    const { data, error } = await client.rpc('get_medha_incidents')
    if (error) throw error
    return array(data).filter(isRecord).map((row) => {
      const report = mapSanketReport(row)
      const overrides = row.priorityOverride
      return {
        ...report,
        reviewHistory: array(row.reviewHistory).map(mapReviewEvent).filter((event): event is MedhaReviewEvent => event !== null),
        duplicateMatches: array(row.duplicateMatches).map(mapDuplicate).filter((match): match is MedhaDuplicateRecord => match !== null),
        storedAssessment: mapAssessment(row.analysis),
        priorityOverride: isRecord(overrides) && ['critical', 'high', 'medium', 'low'].includes(text(overrides.priority))
          ? {
              priority: text(overrides.priority) as MedhaPriority,
              previousPriority: ['critical', 'high', 'medium', 'low'].includes(text(overrides.previousPriority))
                ? text(overrides.previousPriority) as MedhaPriority
                : null,
              reason: text(overrides.reason),
              at: text(overrides.at),
              by: text(overrides.by, 'Reviewer'),
              reviewerId: typeof overrides.reviewerId === 'string' ? overrides.reviewerId : null,
            }
          : null,
      }
    })
  },

  async saveAnalyses(incidents: Array<{ reportId: string }>) {
    if (!incidents.length) return
    if (!supabase && isLocalPreviewEnabled()) {
      for (const item of incidents) {
        const report = reportStore.getById(item.reportId)
        if (report) localAssessments.set(item.reportId, assessPriority(report))
      }
      return
    }
    const client = requireSupabase()
    const { error } = await client.rpc('refresh_medha_analyses', {
      p_report_ids: incidents.map(({ reportId }) => reportId),
    })
    if (error) throw error
  },

  async reviewIncident(reportId: string, action: MedhaReviewAction, note: string) {
    if (!note.trim()) throw new Error('Add a review note before recording this decision.')
    if (!supabase && isLocalPreviewEnabled()) {
      requireLocalPreview()
      if (action === 'verified') reportStore.updateVerification(reportId, 'verified')
      appendLocalReview(reportId, action, note.trim())
      return
    }
    const client = requireSupabase()
    const { error } = await client.rpc('record_medha_review', {
      p_report_id: reportId,
      p_action: action,
      p_note: note.trim(),
    })
    if (error) throw error
  },

  async decideDuplicate(candidate: DuplicateCandidate, decision: MedhaDuplicateDecision, note: string) {
    if (!note.trim()) throw new Error('Add a note explaining the duplicate decision.')
    if (!supabase && isLocalPreviewEnabled()) {
      requireLocalPreview()
      const record: MedhaDuplicateRecord = {
        ...candidate,
        decision,
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'Local preview reviewer',
      }
      const key = `${candidate.firstReportId}:${candidate.secondReportId}`
      localDuplicateRecords.set(key, record)
      const action = decision === 'flagged' ? 'duplicate_flagged'
        : decision === 'confirmed' ? 'duplicate_confirmed' : 'duplicate_rejected'
      appendLocalReview(candidate.firstReportId, action, note.trim(), candidate.secondReportId)
      appendLocalReview(candidate.secondReportId, action, note.trim(), candidate.firstReportId)
      return
    }
    const client = requireSupabase()
    const { error } = await client.rpc('record_medha_duplicate_decision', {
      p_first_report_id: candidate.firstReportId,
      p_second_report_id: candidate.secondReportId,
      p_similarity: candidate.similarity / 100,
      p_reasons: candidate.reasons,
      p_decision: decision,
      p_note: note.trim(),
    })
    if (error) throw error
  },

  async overridePriority(
    reportId: string,
    priority: MedhaPriority,
    reason: string,
  ) {
    if (reason.trim().length < 10) throw new Error('Explain the override in at least 10 characters.')
    if (!supabase && isLocalPreviewEnabled()) {
      requireLocalPreview()
      const incident = reportStore.getById(reportId)
      const previousPriority = incident
        ? localOverrides.get(reportId)?.priority ?? localAssessments.get(reportId)?.priority ?? assessPriority(incident).priority
        : null
      const at = new Date().toISOString()
      const override = {
        priority,
        previousPriority,
        reason: reason.trim(),
        at,
        by: 'Local preview reviewer',
        reviewerId: null,
      }
      localOverrides.set(reportId, override)
      appendLocalReview(reportId, 'priority_overridden', reason.trim())
      return
    }
    const client = requireSupabase()
    const { error } = await client.rpc('record_medha_priority_override', {
      p_report_id: reportId,
      p_override_priority: priority,
      p_reason: reason.trim(),
    })
    if (error) throw error
  },

  async getSenaHandoff(): Promise<MedhaHandoffIncident[]> {
    if (!supabase && isLocalPreviewEnabled()) {
      requireLocalPreview()
      return reportStore.getAll()
        .filter((report) => report.originKind === 'user_submission' && report.verificationStatus === 'verified')
        .map((report) => {
          const incident = localIncident(report)
          const assessment = localAssessments.get(report.id) ?? assessPriority(report)
          const priority = localOverrides.get(report.id)?.priority ?? assessment.priority
          const override = localOverrides.get(report.id)
          return {
            report: incident,
            statusHistory: report.assignmentHistory,
            priority,
            priorityProvenance: {
              source: override ? 'reviewer_override' as const : 'automated_assessment' as const,
              priority,
              previousPriority: override?.previousPriority ?? null,
              reviewerId: null,
              reviewerName: override?.by ?? null,
              reason: override?.reason ?? null,
              changedAt: override?.at ?? null,
              algorithmVersion: assessment?.algorithmVersion ?? 'medha-rules-v1',
              assessedAt: assessment?.assessedAt ?? '',
            },
          }
        })
    }
    const client = requireSupabase()
    const { data, error } = await client.rpc('get_medha_sena_handoff')
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('SENA handoff returned an invalid response.')
    return data.map((item) => {
      if (!isRecord(item)) throw new Error('SENA handoff returned an invalid incident record.')
      const row = item
      const priority = text(row.effectivePriority)
      if (!['critical', 'high', 'medium', 'low'].includes(priority)) {
        throw new Error(`SENA handoff returned an invalid priority for report ${text(row.id, 'unknown')}.`)
      }
      const priorityProvenance = mapPriorityProvenance(row.priorityProvenance)
      if (!priorityProvenance) {
        throw new Error(`SENA handoff did not include valid priority provenance for report ${text(row.id, 'unknown')}.`)
      }
      const report = mapSanketReport(row)
      return {
        report: {
          ...report,
          reviewHistory: array(row.reviewHistory).map(mapReviewEvent).filter((event): event is MedhaReviewEvent => event !== null),
          duplicateMatches: [],
          storedAssessment: mapAssessment(row.analysis),
          priorityOverride: null,
        },
        statusHistory: report.assignmentHistory,
        priority: priority as MedhaPriority,
        priorityProvenance,
      }
    })
  },
}
