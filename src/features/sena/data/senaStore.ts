import { defaultResponseUnits } from './responseUnits.ts'
import type { DispatchOrder, FieldLogEntry, ResponseUnit, SenaDispatchStatus, SenaIncidentItem } from '../types'
import type { MedhaHandoffIncident } from '../../medha/data/repository'
import type { MedhaPriority } from '../../medha/data/intelligence'
import type { SanketCategory } from '../../sanket/types'
import { reportStore } from '../../sanket/data/reportStore.ts'

const VALID_CATEGORIES = new Set<SanketCategory>([
  'flooding',
  'waterlogging',
  'blocked_road',
  'damaged_infrastructure',
  'medical_assistance',
  'shelter_required',
  'food_water',
  'other',
])

const previewVerifiedIncidents: SenaIncidentItem[] = [
  {
    id: 'SNK-9101',
    reportType: 'sos',
    category: 'flooding',
    urgency: 'critical',
    priority: 'critical',
    prioritySource: 'reviewer_override',
    priorityReason: 'Verified 8 stranded villagers near Kundapura bridge; water rising rapidly.',
    summary: 'Flash flood trapped family and neighbors on roof near Kundapura bridge',
    details: 'Water entered houses reaching 5 feet. 8 people including 2 children and an elderly diabetic patient trapped on rooftop. Road cut off.',
    location: {
      label: 'Kundapura Riverfront Bridge Colony',
      locality: 'Basrur Road',
      taluk: 'Kundapura',
      district: 'Udupi',
      latitude: 13.6352,
      longitude: 74.7088,
      source: 'manual',
    },
    assistanceNeeds: ['rescue', 'medical', 'evacuation'],
    reportedImpacts: {
      peopleAffected: 8,
      reportedInjuries: 1,
      vulnerablePeople: 3,
      peopleTrapped: 8,
    },
    reporterName: 'Suresh Bhat',
    reporterPhone: '+91 98451 23456',
    verifiedAt: '2026-11-06T14:30:00+05:30',
    activeDispatch: null,
  },
  {
    id: 'SNK-9102',
    reportType: 'assistance',
    category: 'medical_assistance',
    urgency: 'high',
    priority: 'high',
    prioritySource: 'automated_assessment',
    priorityReason: 'Critical medical need and transport disruption confirmed by field triage.',
    summary: 'Elderly cardiac patient requires emergency oxygen refill and clinic transfer',
    details: 'Power cut in Byndoor locality for 14 hours. Battery backup exhausted on oxygen concentrator. Local roads submerged.',
    location: {
      label: 'Byndoor East Health Subcenter area',
      locality: 'Byndoor',
      taluk: 'Byndoor',
      district: 'Udupi',
      latitude: 13.8640,
      longitude: 74.6390,
      source: 'manual',
    },
    assistanceNeeds: ['medical', 'transport'],
    reportedImpacts: {
      peopleAffected: 2,
      reportedInjuries: 0,
      vulnerablePeople: 1,
      peopleTrapped: 0,
    },
    reporterName: 'Meenakshi Nayak',
    reporterPhone: '+91 97412 34567',
    verifiedAt: '2026-11-06T15:10:00+05:30',
    activeDispatch: null,
  },
  {
    id: 'SNK-9103',
    reportType: 'incident',
    category: 'blocked_road',
    urgency: 'high',
    priority: 'medium',
    prioritySource: 'automated_assessment',
    priorityReason: 'Major arterial road blocked by uprooted banyan trees; blocking ambulance route.',
    summary: 'Uprooted banyan trees completely blocking NH-66 bypass route',
    details: 'Heavy winds brought down three trees across highway. Supply trucks and emergency transport cannot pass toward Brahmavara.',
    location: {
      label: 'NH-66 Brahmavara Junction',
      locality: 'Brahmavara',
      taluk: 'Brahmavara',
      district: 'Udupi',
      latitude: 13.4380,
      longitude: 74.7450,
      source: 'manual',
    },
    assistanceNeeds: ['transport', 'other'],
    reportedImpacts: {
      peopleAffected: 0,
      reportedInjuries: 0,
      vulnerablePeople: 0,
      peopleTrapped: 0,
    },
    reporterName: 'Praveen Shetty',
    reporterPhone: '+91 94801 98765',
    verifiedAt: '2026-11-06T16:00:00+05:30',
    activeDispatch: null,
  },
]

const DISPATCH_STORAGE_KEY = 'abhedya.sena.dispatches_v1'

class SenaStore {
  private units: ResponseUnit[] = JSON.parse(JSON.stringify(defaultResponseUnits))
  private dispatches: Map<string, DispatchOrder> = new Map()
  private incidentOverlays: Map<string, Partial<SenaIncidentItem>> = new Map()

  constructor() {
    this.hydrateFromStorage()
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(DISPATCH_STORAGE_KEY)
      if (!raw) return
      const entries = JSON.parse(raw) as [string, DispatchOrder][]
      if (!Array.isArray(entries)) return
      for (const [incidentId, order] of entries) {
        if (!incidentId || !order) continue
        this.dispatches.set(incidentId, order)
        if (order.status !== 'resolved') {
          const unit = this.units.find((u) => u.id === order.unitId)
          if (unit) {
            unit.status = 'deployed'
            unit.assignedIncidentId = incidentId
          }
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(Array.from(this.dispatches.entries())))
    } catch {
      // ignore storage quota errors
    }
  }

  getUnits(): ResponseUnit[] {
    return [...this.units]
  }

  getUnit(id: string): ResponseUnit | undefined {
    return this.units.find((u) => u.id === id)
  }

  getDispatches(): DispatchOrder[] {
    return Array.from(this.dispatches.values())
  }

  getDispatchForIncident(incidentId: string): DispatchOrder | null {
    return this.dispatches.get(incidentId) ?? null
  }

  getPreviewIncidents(): SenaIncidentItem[] {
    const list: SenaIncidentItem[] = previewVerifiedIncidents.map((incident) => {
      const dispatch = this.dispatches.get(incident.id) ?? null
      const overlay = this.incidentOverlays.get(incident.id) ?? {}
      return {
        ...incident,
        ...overlay,
        activeDispatch: dispatch,
      }
    })

    try {
      const queue = reportStore.getQueue()
      for (const report of queue) {
        if ((report.reportType === 'sos' || report.urgency === 'critical') && !list.some((item) => item.id === report.id)) {
          const dispatch = this.dispatches.get(report.id) ?? null
          const overlay = this.incidentOverlays.get(report.id) ?? {}
          const loc = report.location || {}
          list.unshift({
            id: report.id,
            reportType: report.reportType,
            category: report.category,
            urgency: report.urgency,
            priority: 'critical',
            prioritySource: 'automated_assessment',
            priorityReason: 'Real-time emergency distress beacon dispatch',
            summary: report.summary,
            details: report.details,
            location: {
              label: loc.label || loc.locality || 'Emergency Incident Location',
              locality: loc.locality || 'Udupi',
              taluk: loc.taluk || 'Udupi',
              district: loc.district || 'Udupi',
              latitude: loc.latitude ?? 13.3408,
              longitude: loc.longitude ?? 74.7421,
              source: loc.source || 'device',
            },
            assistanceNeeds: report.assistanceNeeds || ['rescue', 'evacuation'],
            reportedImpacts: report.reportedImpacts || {
              peopleAffected: 1,
              reportedInjuries: 0,
              vulnerablePeople: 0,
              peopleTrapped: 1,
            },
            reporterName: report.reporter?.name || 'Citizen Victim',
            reporterPhone: report.reporter?.phone || '+91 98450 00000',
            verifiedAt: report.createdAt || new Date().toISOString(),
            activeDispatch: dispatch,
            ...overlay,
          })
        }
      }

      const emergencies = reportStore.getEmergencyNotifications()
      for (const notif of emergencies) {
        const repId = notif.reportId || notif.id
        if (repId && !list.some((item) => item.id === repId)) {
          const dispatch = this.dispatches.get(repId) ?? null
          const overlay = this.incidentOverlays.get(repId) ?? {}
          const category: SanketCategory = VALID_CATEGORIES.has(notif.threat as SanketCategory)
            ? (notif.threat as SanketCategory)
            : 'flooding'
          list.unshift({
            id: repId,
            reportType: 'sos',
            category,
            urgency: 'critical',
            priority: 'critical',
            prioritySource: 'automated_assessment',
            priorityReason: 'Live SOS beacon received via Emergency Dispatch stream',
            summary: notif.summary,
            details: notif.details,
            location: {
              label: notif.location.locality || 'Emergency SOS Beacon',
              locality: notif.location.locality || 'Udupi',
              taluk: notif.location.taluk || 'Udupi',
              district: notif.location.district || 'Udupi',
              latitude: notif.location.latitude ?? 13.3408,
              longitude: notif.location.longitude ?? 74.7421,
              source: 'device',
            },
            assistanceNeeds: ['rescue', 'evacuation'],
            reportedImpacts: {
              peopleAffected: 1,
              reportedInjuries: null,
              vulnerablePeople: null,
              peopleTrapped: 1,
            },
            reporterName: notif.reporter?.name || 'Citizen SOS Caller',
            reporterPhone: notif.reporter?.phone || '+91 94812 99999',
            verifiedAt: notif.timestamp,
            activeDispatch: dispatch,
            ...overlay,
          })
        }
      }
    } catch {
      // fallback
    }

    return list
  }

  convertHandoffToItem(handoff: MedhaHandoffIncident): SenaIncidentItem {
    const report = handoff.report
    const dispatch = this.dispatches.get(report.id) ?? null
    const overlay = this.incidentOverlays.get(report.id) ?? {}
    return {
      id: report.id,
      reportType: report.reportType,
      category: report.category,
      urgency: report.urgency,
      priority: handoff.priority,
      prioritySource: handoff.priorityProvenance.source,
      priorityReason: handoff.priorityProvenance.reason,
      summary: report.summary,
      details: report.details,
      location: report.location,
      assistanceNeeds: report.assistanceNeeds,
      reportedImpacts: report.reportedImpacts,
      reporterName: report.reporter.name,
      reporterPhone: report.reporter.phone,
      verifiedAt: handoff.priorityProvenance.assessedAt || new Date().toISOString(),
      rawHandoff: handoff,
      activeDispatch: dispatch,
      ...overlay,
    }
  }

  dispatchTeam(params: {
    incidentId: string
    unitId: string
    priority: MedhaPriority
    missionBrief: string
    assignedBy: string
  }): DispatchOrder {
    const unit = this.units.find((u) => u.id === params.unitId)
    if (!unit) throw new Error(`Response unit ${params.unitId} not found`)

    const now = new Date().toISOString()
    const dispatchId = `DSP-${Math.floor(1000 + Math.random() * 9000)}`

    const initialLog: FieldLogEntry = {
      id: `${dispatchId}-log-1`,
      at: now,
      by: params.assignedBy,
      text: `Unit ${unit.name} dispatched with order: "${params.missionBrief}"`,
      stage: 'dispatched',
    }

    const order: DispatchOrder = {
      id: dispatchId,
      incidentId: params.incidentId,
      unitId: unit.id,
      unitName: unit.name,
      status: 'dispatched',
      priority: params.priority,
      missionBrief: params.missionBrief,
      dispatchedAt: now,
      updatedAt: now,
      assignedBy: params.assignedBy,
      fieldLogs: [initialLog],
      outcome: null,
    }

    // Update unit status
    unit.status = 'deployed'
    unit.assignedIncidentId = params.incidentId

    this.dispatches.set(params.incidentId, order)
    this.persistToStorage()

    // Also update reportStore if local preview report exists
    try {
      reportStore.assignReport(params.incidentId, unit.name, `Dispatched response unit ${unit.callSign}`)
      reportStore.updateStatus(params.incidentId, 'in_progress', params.assignedBy, `Team ${unit.callSign} mobilized`)
      reportStore.acknowledgeEmergency(params.incidentId, unit.name)
    } catch {
      // non-blocking
    }

    return order
  }

  updateDispatchStage(params: {
    incidentId: string
    status: SenaDispatchStatus
    updatedBy: string
    note: string
    outcome?: {
      rescuedCount?: number
      assistedCount?: number
      notes?: string
    }
  }): DispatchOrder {
    const order = this.dispatches.get(params.incidentId)
    if (!order) throw new Error(`No active dispatch found for incident ${params.incidentId}`)

    const now = new Date().toISOString()
    order.status = params.status
    order.updatedAt = now

    const logEntry: FieldLogEntry = {
      id: `${order.id}-log-${order.fieldLogs.length + 1}`,
      at: now,
      by: params.updatedBy,
      text: params.note,
      stage: params.status,
    }
    order.fieldLogs.push(logEntry)

    if (params.status === 'resolved') {
      order.outcome = {
        rescuedCount: params.outcome?.rescuedCount ?? 0,
        assistedCount: params.outcome?.assistedCount ?? 0,
        notes: params.outcome?.notes ?? params.note,
        completedAt: now,
      }

      // Free unit
      const unit = this.units.find((u) => u.id === order.unitId)
      if (unit) {
        unit.status = 'available'
        unit.assignedIncidentId = null
      }

      try {
        reportStore.updateStatus(params.incidentId, 'resolved', params.updatedBy, params.note)
      } catch {
        // non-blocking
      }
    }

    this.persistToStorage()
    return order
  }

  appendFieldLog(incidentId: string, text: string, by: string): FieldLogEntry {
    const order = this.dispatches.get(incidentId)
    if (!order) throw new Error(`No active dispatch found for incident ${incidentId}`)

    const entry: FieldLogEntry = {
      id: `${order.id}-log-${order.fieldLogs.length + 1}`,
      at: new Date().toISOString(),
      by,
      text,
      stage: order.status,
    }
    order.fieldLogs.push(entry)
    order.updatedAt = entry.at
    this.persistToStorage()
    return entry
  }
}

export const senaStore = new SenaStore()
