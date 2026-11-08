import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import type {
  SanketReport,
  SanketReportDraft,
  SanketStatus,
} from '../types'
import { reportStore } from './reportStore'

interface DbReportRow {
  id: string
  report_type: string
  category: string
  urgency: string
  status: string
  summary: string
  details: string
  assistance_needs: string[] | null
  locality: string
  taluk: string
  district: string
  latitude: number | null
  longitude: number | null
  location_label: string | null
  location_source: string | null
  reporter_name: string
  reporter_phone: string
  contact_preference: string | null
  created_by: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  created_at: string
  updated_at: string
}

interface DbHistoryRow {
  id: string
  report_id: string
  from_status: string
  to_status: string
  actor_id: string | null
  actor_name: string
  note: string | null
  created_at: string
}

function mapDbRowToReport(row: DbReportRow, history: DbHistoryRow[] = []): SanketReport {
  return {
    id: row.id,
    reportType: row.report_type as SanketReport['reportType'],
    category: row.category as SanketReport['category'],
    urgency: row.urgency as SanketReport['urgency'],
    status: row.status as SanketReport['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    location: {
      label: row.location_label || `${row.locality}, ${row.taluk}`,
      locality: row.locality,
      taluk: row.taluk,
      district: row.district || 'Udupi',
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      source: (row.location_source as SanketReport['location']['source']) || 'manual',
    },
    reporter: {
      name: row.reporter_name,
      phone: row.reporter_phone,
      contactPreference: (row.contact_preference as SanketReport['reporter']['contactPreference']) || 'phone',
    },
    assistanceNeeds: (row.assistance_needs as SanketReport['assistanceNeeds']) || [],
    summary: row.summary,
    details: row.details,
    assignedTo: row.assigned_to_name || (row.assigned_to ? 'Assigned Responder' : undefined),
    assignmentHistory: history.map((h) => ({
      from: h.from_status as SanketStatus,
      to: h.to_status as SanketStatus,
      at: h.created_at,
      by: h.actor_name,
      note: h.note || undefined,
    })),
    provenance: {
      sourceMode: isSupabaseConfigured ? 'live' : 'prototype',
      sourceLabel: isSupabaseConfigured ? 'Supabase Live Database' : 'Prototype Browser Store',
      note: isSupabaseConfigured
        ? 'Verified database record stored in Udupi District incident registry.'
        : 'In-memory prototype store.',
    },
  }
}

export const sanketRepository = {
  async submitReport(draft: SanketReportDraft, createdByUserId?: string): Promise<SanketReport> {
    if (!isSupabaseConfigured || !supabase) {
      // Prototype mode
      return reportStore.add(draft)
    }

    // Live Supabase mode: MUST NOT silently fall back to mock data
    const payload = {
      report_type: draft.reportType,
      category: draft.category,
      urgency: draft.urgency,
      summary: draft.summary,
      details: draft.details,
      assistance_needs: draft.assistanceNeeds,
      locality: draft.location.locality,
      taluk: draft.location.taluk,
      district: draft.location.district || 'Udupi',
      latitude: draft.location.latitude ?? null,
      longitude: draft.location.longitude ?? null,
      location_label: draft.location.label || `${draft.location.locality}, ${draft.location.taluk}`,
      location_source: draft.location.source || 'manual',
      reporter_name: draft.reporter.name,
      reporter_phone: draft.reporter.phone,
      contact_preference: draft.reporter.contactPreference || 'phone',
      created_by: createdByUserId || null,
      status: 'incoming',
    }

    const { data, error } = await supabase
      .from('sanket_reports')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Supabase submitReport error:', error)
      throw new Error(`Failed to submit incident to Supabase: ${error.message}`)
    }

    const newReportRow = data as DbReportRow

    // Record initial history entry
    const { error: histError } = await supabase.from('sanket_status_history').insert({
      report_id: newReportRow.id,
      from_status: 'submitted',
      to_status: 'incoming',
      actor_id: createdByUserId || null,
      actor_name: draft.reporter.name || 'Citizen Reporter',
      note: 'Incident submitted to Udupi District Emergency Cell.',
    })

    if (histError) {
      console.warn('Initial status history insertion notice:', histError.message)
    }

    return mapDbRowToReport(newReportRow, [
      {
        id: 'initial',
        report_id: newReportRow.id,
        from_status: 'submitted',
        to_status: 'incoming',
        actor_id: createdByUserId || null,
        actor_name: draft.reporter.name || 'Citizen Reporter',
        note: 'Incident submitted to Udupi District Emergency Cell.',
        created_at: newReportRow.created_at,
      },
    ])
  },

  async getAllReports(userId?: string): Promise<SanketReport[]> {
    if (!isSupabaseConfigured || !supabase) {
      return reportStore.getAll()
    }

    let query = supabase.from('sanket_reports').select('*').order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('created_by', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase getAllReports error:', error)
      throw new Error(`Failed to fetch reports from Supabase: ${error.message}`)
    }

    const rows = (data || []) as DbReportRow[]
    return rows.map((r) => mapDbRowToReport(r))
  },

  async getHelperQueue(): Promise<SanketReport[]> {
    if (!isSupabaseConfigured || !supabase) {
      return reportStore.getQueue()
    }

    const { data, error } = await supabase
      .from('sanket_reports')
      .select('*')
      .neq('status', 'closed')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase getHelperQueue error:', error)
      throw new Error(`Failed to load incident queue: ${error.message}`)
    }

    const rows = (data || []) as DbReportRow[]
    return rows.map((r) => mapDbRowToReport(r))
  },

  async getReportDetails(id: string): Promise<SanketReport | null> {
    if (!isSupabaseConfigured || !supabase) {
      return reportStore.getById(id)
    }

    const { data: reportData, error: reportError } = await supabase
      .from('sanket_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (reportError) {
      console.error('Supabase getReportDetails error:', reportError)
      throw new Error(`Report ${id} could not be retrieved: ${reportError.message}`)
    }

    if (!reportData) return null

    // Fetch history
    const { data: histData } = await supabase
      .from('sanket_status_history')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: true })

    const history = (histData || []) as DbHistoryRow[]
    return mapDbRowToReport(reportData as DbReportRow, history)
  },

  async assignReport(
    id: string,
    helperId?: string,
    helperName?: string,
    note?: string
  ): Promise<SanketReport> {
    if (!isSupabaseConfigured || !supabase) {
      const res = reportStore.assignReport(id, helperName || 'Helper Volunteer', note)
      if (!res) throw new Error('Report assignment failed in local store.')
      return res
    }

    // Try RPC assign_sanket_report
    const { data: rpcData, error: rpcError } = await supabase.rpc('assign_sanket_report', {
      p_report_id: id,
      p_note: note || 'Assigned to responder for triage.',
    })

    if (!rpcError && rpcData) {
      return this.getReportDetails(id) as Promise<SanketReport>
    }

    // Fallback direct table update if RPC not applied yet
    const { error: updateError } = await supabase
      .from('sanket_reports')
      .update({
        assigned_to: helperId || null,
        assigned_to_name: helperName || 'Authorized Responder',
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      throw new Error(`Assignment update failed: ${updateError.message}`)
    }

    // Insert history
    await supabase.from('sanket_status_history').insert({
      report_id: id,
      from_status: 'incoming',
      to_status: 'assigned',
      actor_id: helperId || null,
      actor_name: helperName || 'Authorized Responder',
      note: note || 'Assigned to helper for follow-up.',
    })

    const updated = await this.getReportDetails(id)
    if (!updated) throw new Error('Could not reload report after assignment.')
    return updated
  },

  async updateStatus(
    id: string,
    newStatus: SanketStatus,
    actorId?: string,
    actorName?: string,
    note?: string
  ): Promise<SanketReport> {
    if (!isSupabaseConfigured || !supabase) {
      const res = reportStore.updateStatus(id, newStatus, actorName || 'Helper workflow', note)
      if (!res) throw new Error(`Transition to ${newStatus} is not permitted from current status.`)
      return res
    }

    // Try RPC update_sanket_status
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_sanket_status', {
      p_report_id: id,
      p_new_status: newStatus,
      p_note: note || `Status updated to ${newStatus}`,
    })

    if (!rpcError && rpcData) {
      return this.getReportDetails(id) as Promise<SanketReport>
    }

    // Fallback direct update
    const current = await this.getReportDetails(id)
    const prevStatus = current?.status || 'incoming'

    const { error: updateError } = await supabase
      .from('sanket_reports')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      throw new Error(`Status update failed: ${updateError.message}`)
    }

    await supabase.from('sanket_status_history').insert({
      report_id: id,
      from_status: prevStatus,
      to_status: newStatus,
      actor_id: actorId || null,
      actor_name: actorName || 'Authorized Responder',
      note: note || `Status updated to ${newStatus}`,
    })

    const updated = await this.getReportDetails(id)
    if (!updated) throw new Error('Could not reload report after status update.')
    return updated
  },

  async getRestrictedContactInfo(reportId: string): Promise<{
    name: string
    phone: string
    preference: string
  }> {
    if (!isSupabaseConfigured || !supabase) {
      const r = reportStore.getById(reportId)
      return {
        name: r?.reporter.name || 'Anonymous',
        phone: r?.reporter.phone || 'Not provided',
        preference: r?.reporter.contactPreference || 'phone',
      }
    }

    // Call secure function get_report_contact
    const { data, error } = await supabase.rpc('get_report_contact', {
      p_report_id: reportId,
    })

    if (error) {
      throw new Error(`Access Denied: ${error.message}`)
    }

    if (data && data.length > 0) {
      return {
        name: data[0].reporter_name,
        phone: data[0].reporter_phone,
        preference: data[0].contact_preference,
      }
    }

    throw new Error('Contact information could not be retrieved.')
  },
}
