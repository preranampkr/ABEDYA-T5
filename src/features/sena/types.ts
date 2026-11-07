import type { SanketAssistanceNeed, SanketCategory, SanketLocation, SanketUrgency } from '../sanket/types'
import type { MedhaHandoffIncident } from '../medha/data/repository'
import type { MedhaPriority } from '../medha/data/intelligence'

export type SenaDispatchStatus =
  | 'pending_dispatch'
  | 'dispatched'
  | 'en_route'
  | 'on_scene'
  | 'operation_underway'
  | 'resolved'

export type SenaCapability =
  | 'water_rescue'
  | 'medical_triage'
  | 'evacuation'
  | 'debris_clearance'
  | 'supply_distribution'
  | 'aerial_recon'

export interface ResponseUnit {
  id: string
  name: string
  agency: 'NDRF' | 'SDRF' | 'Fire & Emergency' | 'District Health' | 'Civil Defense' | 'Volunteer Corps'
  callSign: string
  leader: string
  phone: string
  personnelCount: number
  status: 'available' | 'deployed' | 'rest'
  capabilities: SenaCapability[]
  baseLocation: SanketLocation
  currentLocation: SanketLocation
  assignedIncidentId: string | null
}

export interface FieldLogEntry {
  id: string
  at: string
  by: string
  text: string
  stage?: SenaDispatchStatus
}

export interface DispatchOrder {
  id: string
  incidentId: string
  unitId: string
  unitName: string
  status: SenaDispatchStatus
  priority: MedhaPriority
  missionBrief: string
  dispatchedAt: string
  updatedAt: string
  assignedBy: string
  fieldLogs: FieldLogEntry[]
  outcome: {
    rescuedCount?: number
    assistedCount?: number
    notes?: string
    completedAt?: string
  } | null
}

export interface SenaIncidentItem {
  id: string
  reportType: 'sos' | 'incident' | 'assistance'
  category: SanketCategory
  urgency: SanketUrgency
  priority: MedhaPriority
  prioritySource: 'automated_assessment' | 'reviewer_override'
  priorityReason: string | null
  summary: string
  details: string
  location: SanketLocation
  assistanceNeeds: SanketAssistanceNeed[]
  reportedImpacts: {
    peopleAffected: number | null
    reportedInjuries: number | null
    vulnerablePeople: number | null
    peopleTrapped: number | null
  }
  reporterName: string
  reporterPhone: string
  verifiedAt: string
  rawHandoff?: MedhaHandoffIncident
  activeDispatch: DispatchOrder | null
}
