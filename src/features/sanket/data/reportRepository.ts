import { supabase } from '../../../lib/supabase'
import { isLocalPreviewEnabled } from '../../../lib/localPreview'
import { reportStore } from './reportStore'
import type {
  SanketAssignmentHistoryEntry,
  SanketCategory,
  SanketOperationalNote,
  SanketReport,
  SanketReportDraft,
  SanketReportType,
  SanketSourceMode,
  SanketStatus,
  SanketStatusHistoryEntry,
  SanketUrgency,
  SanketVerificationStatus,
} from '../types'

interface JsonRecord {
  [key: string]: unknown
}

const asObject = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
)

const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const asNullableNumber = (value: unknown) => typeof value === 'number' ? value : undefined

function mapStatusHistory(value: unknown): SanketStatusHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const item = asObject(entry)
    return {
      from: (item.from as SanketStatus | null) ?? null,
      to: item.to as SanketStatus,
      at: asString(item.at),
      by: asString(item.by),
      note: typeof item.note === 'string' ? item.note : undefined,
    }
  })
}

function mapAssignmentHistory(value: unknown): SanketAssignmentHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const item = asObject(entry)
    return {
      helperId: typeof item.helperId === 'string' ? item.helperId : null,
      helperName: asString(item.helperName),
      assignedBy: typeof item.assignedBy === 'string' ? item.assignedBy : null,
      assignedAt: asString(item.assignedAt),
      endedAt: typeof item.endedAt === 'string' ? item.endedAt : null,
      note: typeof item.note === 'string' ? item.note : undefined,
    }
  })
}

function mapNotes(value: unknown): SanketOperationalNote[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const item = asObject(entry)
    return {
      id: asString(item.id),
      authorId: typeof item.authorId === 'string' ? item.authorId : null,
      note: asString(item.note),
      createdAt: asString(item.createdAt),
      updatedAt: asString(item.updatedAt),
    }
  })
}

export function mapSanketReport(value: unknown): SanketReport {
  const record = asObject(value)
  const location = asObject(record.location)
  const reporter = asObject(record.reporter)
  const reportedImpacts = asObject(record.reportedImpacts)
  const provenance = asObject(record.provenance)
  return {
    id: asString(record.id),
    reportType: record.reportType as SanketReportType,
    category: record.category as SanketCategory,
    urgency: record.urgency as SanketUrgency,
    status: record.status as SanketStatus,
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
    location: {
      label: asString(location.label, 'Unverified location'),
      locality: asString(location.locality),
      taluk: asString(location.taluk),
      district: asString(location.district),
      latitude: asNullableNumber(location.latitude),
      longitude: asNullableNumber(location.longitude),
      source: location.source as SanketReport['location']['source'],
    },
    reporter: {
      name: asString(reporter.name),
      phone: asString(reporter.phone),
      contactPreference: reporter.contactPreference as SanketReport['reporter']['contactPreference'],
    },
    reportedImpacts: {
      peopleAffected: asNullableNumber(reportedImpacts.peopleAffected) ?? null,
      reportedInjuries: asNullableNumber(reportedImpacts.reportedInjuries) ?? null,
      vulnerablePeople: asNullableNumber(reportedImpacts.vulnerablePeople) ?? null,
      peopleTrapped: asNullableNumber(reportedImpacts.peopleTrapped) ?? null,
    },
    canAccessContact: record.canAccessContact === true,
    assistanceNeeds: Array.isArray(record.assistanceNeeds) ? record.assistanceNeeds as SanketReport['assistanceNeeds'] : [],
    summary: asString(record.summary),
    details: asString(record.details),
    assignedTo: typeof record.assignedTo === 'string' ? record.assignedTo : undefined,
    assignmentHistory: mapStatusHistory(record.assignmentHistory),
    assignmentEvents: mapAssignmentHistory(record.assignmentEvents),
    operationalNotes: mapNotes(record.operationalNotes),
    provenance: {
      sourceMode: provenance.sourceMode as SanketSourceMode,
      sourceLabel: asString(provenance.sourceLabel),
      note: asString(provenance.note),
    },
    originKind: record.originKind as SanketReport['originKind'],
    verificationStatus: record.verificationStatus as SanketVerificationStatus,
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function isLocalPrototype() {
  return !supabase && isLocalPreviewEnabled()
}

function requirePrototypeReport(id: string) {
  const report = reportStore.getById(id)
  if (!report) throw new Error('The report could not be found.')
  return report
}

async function fetchReportDetails(id: string) {
  if (isLocalPrototype()) return requirePrototypeReport(id)
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_sanket_report_details', { p_report_id: id })
  if (error) throw error
  if (!data) throw new Error('The report could not be found.')
  return mapSanketReport(data)
}

export const reportRepository = {
  async listVictimReports(): Promise<SanketReport[]> {
    if (isLocalPrototype()) {
      return reportStore.getAll().filter((report) => report.originKind === 'user_submission')
    }
    const client = requireSupabase()
    const { data, error } = await client.rpc('get_my_sanket_report_codes')
    if (error) throw error
    const rows = (data ?? []) as { id: string }[]
    return Promise.all(rows.map(({ id }) => fetchReportDetails(id)))
  },

  async listHelperQueue(): Promise<SanketReport[]> {
    if (isLocalPrototype()) return reportStore.getQueue()
    const client = requireSupabase()
    const { data, error } = await client.rpc('get_sanket_helper_queue')
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    return rows.map(mapSanketReport)
  },

  getReport: fetchReportDetails,

  async getReportContact(id: string) {
    if (isLocalPrototype()) return requirePrototypeReport(id).reporter
    const client = requireSupabase()
    const { data, error } = await client.rpc('get_sanket_report_contact', { p_report_id: id })
    if (error) throw error
    const contact = asObject(data)
    return {
      name: asString(contact.name),
      phone: asString(contact.phone),
      contactPreference: contact.contactPreference as SanketReport['reporter']['contactPreference'],
    }
  },

  async createReport(draft: SanketReportDraft): Promise<SanketReport> {
    if (isLocalPrototype()) return reportStore.add(draft)
    const client = requireSupabase()
    const { data, error } = await client.rpc('create_sanket_report', { p_report: draft })
    if (error) throw error
    return fetchReportDetails(String(data))
  },

  async reviewReport(id: string, note?: string) {
    if (isLocalPrototype()) {
      const report = reportStore.updateStatus(id, 'under_review', 'Local preview helper', note)
      if (!report) throw new Error('The report cannot be reviewed from its current status.')
      return report
    }
    const client = requireSupabase()
    const { error } = await client.rpc('transition_sanket_report', {
      p_report_id: id,
      p_to_status: 'under_review',
      p_note: note ?? null,
    })
    if (error) throw error
    return fetchReportDetails(id)
  },

  async receiveReport(id: string, note?: string) {
    if (isLocalPrototype()) {
      const report = reportStore.updateStatus(id, 'incoming', 'Local preview helper', note)
      if (!report) throw new Error('The report cannot be received from its current status.')
      return report
    }
    const client = requireSupabase()
    const { error } = await client.rpc('transition_sanket_report', {
      p_report_id: id,
      p_to_status: 'incoming',
      p_note: note ?? null,
    })
    if (error) throw error
    return fetchReportDetails(id)
  },

  async updateStatus(id: string, status: SanketStatus, note?: string) {
    if (isLocalPrototype()) {
      const report = reportStore.updateStatus(id, status, 'Local preview helper', note)
      if (!report) throw new Error('The report cannot move to that status from its current status.')
      return report
    }
    const client = requireSupabase()
    const { error } = await client.rpc('transition_sanket_report', {
      p_report_id: id,
      p_to_status: status,
      p_note: note ?? null,
    })
    if (error) throw error
    return fetchReportDetails(id)
  },

  async assignReport(id: string, note?: string) {
    if (isLocalPrototype()) {
      const report = reportStore.assignReport(id, 'Local preview helper', note)
      if (!report) throw new Error('The report cannot be assigned from its current status.')
      return report
    }
    const client = requireSupabase()
    const { error } = await client.rpc('assign_sanket_report', {
      p_report_id: id,
      p_helper_id: null,
      p_note: note ?? null,
    })
    if (error) throw error
    return fetchReportDetails(id)
  },

  async updateUrgency(id: string, urgency: SanketUrgency) {
    if (isLocalPrototype()) {
      const report = reportStore.updateUrgency(id, urgency)
      if (!report) throw new Error('The report could not be found.')
      return report
    }
    const client = requireSupabase()
    const { error } = await client.rpc('update_sanket_urgency', { p_report_id: id, p_urgency: urgency })
    if (error) throw error
    return fetchReportDetails(id)
  },

  async addOperationalNote(id: string, note: string) {
    const client = requireSupabase()
    const { error } = await client.rpc('add_sanket_report_note', { p_report_id: id, p_note: note })
    if (error) throw error
    return fetchReportDetails(id)
  },
}