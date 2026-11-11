import type { IncomingMessage, ServerResponse } from 'node:http'
import { authenticateRequest, methodNotAllowed, readJsonBody, sendJson } from '../_lib/server.ts'

interface DbUnitRow {
  id: string
  name: string
  agency: string
  call_sign: string
  leader: string
  phone: string
  personnel_count: number
  status: 'available' | 'deployed' | 'rest'
  capabilities: string[]
  base_location: Record<string, unknown>
  current_location: Record<string, unknown>
  assigned_incident_id: string | null
}

interface DbDispatchRow {
  id: string
  incident_id: string
  unit_id: string
  unit_name: string
  status: string
  priority: string
  mission_brief: string
  dispatched_at: string
  updated_at: string
  assigned_by: string
  field_logs: Array<{ id: string; at: string; by: string; text: string; stage?: string }>
  outcome: {
    rescuedCount?: number
    assistedCount?: number
    notes?: string
    completedAt?: string
  } | null
}

function mapUnit(row: DbUnitRow) {
  return {
    id: row.id,
    name: row.name,
    agency: row.agency,
    callSign: row.call_sign,
    leader: row.leader,
    phone: row.phone,
    personnelCount: row.personnel_count,
    status: row.status,
    capabilities: row.capabilities ?? [],
    baseLocation: row.base_location,
    currentLocation: row.current_location,
    assignedIncidentId: row.assigned_incident_id,
  }
}

function mapDispatch(row: DbDispatchRow) {
  return {
    id: row.id,
    incidentId: row.incident_id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    status: row.status,
    priority: row.priority,
    missionBrief: row.mission_brief,
    dispatchedAt: row.dispatched_at,
    updatedAt: row.updated_at,
    assignedBy: row.assigned_by,
    fieldLogs: Array.isArray(row.field_logs) ? row.field_logs : [],
    outcome: row.outcome ?? null,
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!['GET', 'POST', 'PATCH'].includes(req.method || '')) {
    methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
    return
  }

  const auth = await authenticateRequest(req, res, ['helper', 'admin'])
  if (!auth) return

  try {
    if (req.method === 'GET') {
      const [unitsResult, dispatchesResult] = await Promise.all([
        auth.db.from('sena_response_units').select('*').order('id', { ascending: true }),
        auth.db.from('sena_dispatch_orders').select('*').order('dispatched_at', { ascending: false }),
      ])

      if (unitsResult.error) throw unitsResult.error
      if (dispatchesResult.error) throw dispatchesResult.error

      sendJson(res, 200, {
        units: (unitsResult.data as DbUnitRow[]).map(mapUnit),
        dispatches: (dispatchesResult.data as DbDispatchRow[]).map(mapDispatch),
      })
      return
    }

    const body = await readJsonBody<Record<string, unknown>>(req)

    if (req.method === 'POST') {
      const action = typeof body.action === 'string' ? body.action : 'dispatch'

      if (action === 'log') {
        const incidentId = typeof body.incidentId === 'string' ? body.incidentId.trim() : ''
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        const by = (typeof body.by === 'string' && body.by.trim()) || auth.displayName
        if (!incidentId || !text) {
          sendJson(res, 400, { error: 'incidentId and text are required to append a field log.' })
          return
        }

        const { data: existing, error: fetchErr } = await auth.db
          .from('sena_dispatch_orders')
          .select('*')
          .eq('incident_id', incidentId)
          .maybeSingle()

        if (fetchErr || !existing) {
          sendJson(res, 404, { error: `No active dispatch order found for ${incidentId}.` })
          return
        }

        const row = existing as DbDispatchRow
        const nextEntry = {
          id: `${row.id}-log-${(row.field_logs?.length ?? 0) + 1}`,
          at: new Date().toISOString(),
          by,
          text,
          stage: row.status,
        }
        const updatedLogs = [...(row.field_logs ?? []), nextEntry]

        const { error: updateErr } = await auth.db
          .from('sena_dispatch_orders')
          .update({ field_logs: updatedLogs, updated_at: nextEntry.at })
          .eq('id', row.id)

        if (updateErr) throw updateErr
        sendJson(res, 200, { entry: nextEntry })
        return
      }

      // Default POST: authorize team dispatch
      const incidentId = typeof body.incidentId === 'string' ? body.incidentId.trim() : ''
      const unitId = typeof body.unitId === 'string' ? body.unitId.trim() : ''
      const missionBrief = typeof body.missionBrief === 'string' ? body.missionBrief.trim() : ''
      const priority = typeof body.priority === 'string' ? body.priority : 'high'
      const assignedBy = (typeof body.assignedBy === 'string' && body.assignedBy.trim()) || auth.displayName

      if (!incidentId || !unitId || !missionBrief) {
        sendJson(res, 400, { error: 'incidentId, unitId, and missionBrief are required.' })
        return
      }

      const { data: unitData, error: unitErr } = await auth.db
        .from('sena_response_units')
        .select('*')
        .eq('id', unitId)
        .maybeSingle()

      if (unitErr || !unitData) {
        sendJson(res, 404, { error: `Response unit ${unitId} not found.` })
        return
      }

      const unit = unitData as DbUnitRow
      const now = new Date().toISOString()
      const dispatchId = `DSP-${Math.floor(1000 + Math.random() * 9000)}`
      const initialLog = {
        id: `${dispatchId}-log-1`,
        at: now,
        by: assignedBy,
        text: `Unit ${unit.name} dispatched with order: "${missionBrief}"`,
        stage: 'dispatched',
      }

      const { data: inserted, error: insertErr } = await auth.db
        .from('sena_dispatch_orders')
        .upsert(
          {
            id: dispatchId,
            incident_id: incidentId,
            unit_id: unit.id,
            unit_name: unit.name,
            status: 'dispatched',
            priority,
            mission_brief: missionBrief,
            dispatched_at: now,
            updated_at: now,
            assigned_by_id: auth.userId,
            assigned_by: assignedBy,
            field_logs: [initialLog],
            outcome: null,
          },
          { onConflict: 'incident_id' },
        )
        .select()
        .single()

      if (insertErr) throw insertErr

      await auth.db
        .from('sena_response_units')
        .update({ status: 'deployed', assigned_incident_id: incidentId, updated_at: now })
        .eq('id', unit.id)

      // Advance SANKET lifecycle non-blockingly when applicable
      try {
        await auth.db.rpc('assign_sanket_report', {
          p_report_id: incidentId,
          p_helper_id: null,
          p_note: `Dispatched ${unit.name} (${unit.call_sign})`,
        })
        await auth.db.rpc('transition_sanket_report', {
          p_report_id: incidentId,
          p_to_status: 'in_progress',
          p_note: `SENA Order ${dispatchId} active`,
        })
      } catch {
        // Report status may already be assigned/in_progress
      }

      sendJson(res, 201, { order: mapDispatch(inserted as DbDispatchRow) })
      return
    }

    // PATCH: advance operation stage
    const incidentId = typeof body.incidentId === 'string' ? body.incidentId.trim() : ''
    const status = typeof body.status === 'string' ? body.status.trim() : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const updatedBy = (typeof body.updatedBy === 'string' && body.updatedBy.trim()) || auth.displayName
    const outcomeInput =
      body.outcome && typeof body.outcome === 'object' ? (body.outcome as Record<string, unknown>) : null

    if (!incidentId || !status) {
      sendJson(res, 400, { error: 'incidentId and status are required.' })
      return
    }

    const { data: existing, error: fetchErr } = await auth.db
      .from('sena_dispatch_orders')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()

    if (fetchErr || !existing) {
      sendJson(res, 404, { error: `No active dispatch found for incident ${incidentId}.` })
      return
    }

    const row = existing as DbDispatchRow
    const now = new Date().toISOString()
    const logEntry = {
      id: `${row.id}-log-${(row.field_logs?.length ?? 0) + 1}`,
      at: now,
      by: updatedBy,
      text: note || `Stage transitioned to ${status}`,
      stage: status,
    }
    const nextOutcome =
      status === 'resolved'
        ? {
            rescuedCount: typeof outcomeInput?.rescuedCount === 'number' ? outcomeInput.rescuedCount : 0,
            assistedCount: typeof outcomeInput?.assistedCount === 'number' ? outcomeInput.assistedCount : 0,
            notes: (typeof outcomeInput?.notes === 'string' && outcomeInput.notes.trim()) || note,
            completedAt: now,
          }
        : row.outcome

    const { data: updated, error: updateErr } = await auth.db
      .from('sena_dispatch_orders')
      .update({
        status,
        updated_at: now,
        field_logs: [...(row.field_logs ?? []), logEntry],
        outcome: nextOutcome,
      })
      .eq('id', row.id)
      .select()
      .single()

    if (updateErr) throw updateErr

    if (status === 'resolved') {
      await auth.db
        .from('sena_response_units')
        .update({ status: 'available', assigned_incident_id: null, updated_at: now })
        .eq('id', row.unit_id)

      try {
        await auth.db.rpc('transition_sanket_report', {
          p_report_id: incidentId,
          p_to_status: 'resolved',
          p_note: note || 'Mission resolved by SENA',
        })
      } catch {
        // Report status may already be resolved
      }
    }

    sendJson(res, 200, { order: mapDispatch(updated as DbDispatchRow) })
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'SENA backend operation failed.',
    })
  }
}

