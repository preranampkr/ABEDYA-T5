export type SanketReportType = 'sos' | 'incident' | 'assistance'
export type SanketCategory =
  | 'flooding'
  | 'waterlogging'
  | 'blocked_road'
  | 'damaged_infrastructure'
  | 'medical_assistance'
  | 'shelter_required'
  | 'food_water'
  | 'other'

export type SanketUrgency = 'low' | 'medium' | 'high' | 'critical'

export type SanketStatus =
  | 'draft'
  | 'submitted'
  | 'incoming'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'

export type SanketAssistanceNeed =
  | 'rescue'
  | 'medical'
  | 'evacuation'
  | 'shelter'
  | 'food_water'
  | 'transport'
  | 'other'

export type SanketSourceMode = 'prototype' | 'demo' | 'live'

export interface SanketLocation {
  label: string
  locality: string
  taluk: string
  district: string
  latitude?: number
  longitude?: number
  source: 'manual' | 'device' | 'unverified'
}

export interface SanketReporter {
  name: string
  phone: string
  contactPreference: 'phone' | 'sms' | 'voice' | 'none'
}

export interface SanketStatusHistoryEntry {
  from: SanketStatus
  to: SanketStatus
  at: string
  by: string
  note?: string
}

export interface SanketReport {
  id: string
  reportType: SanketReportType
  category: SanketCategory
  urgency: SanketUrgency
  status: SanketStatus
  createdAt: string
  updatedAt: string
  location: SanketLocation
  reporter: SanketReporter
  assistanceNeeds: SanketAssistanceNeed[]
  summary: string
  details: string
  assignedTo?: string
  assignmentHistory: SanketStatusHistoryEntry[]
  provenance: {
    sourceMode: SanketSourceMode
    sourceLabel: string
    note: string
  }
}

export interface SanketReportDraft {
  reportType: SanketReportType
  category: SanketCategory
  urgency: SanketUrgency
  location: {
    label: string
    locality: string
    taluk: string
    district: string
    latitude?: number
    longitude?: number
    source: 'manual' | 'device' | 'unverified'
  }
  reporter: {
    name: string
    phone: string
    contactPreference: 'phone' | 'sms' | 'voice' | 'none'
  }
  assistanceNeeds: SanketAssistanceNeed[]
  summary: string
  details: string
}

export interface SanketHelperQueueItem {
  id: string
  status: SanketStatus
  urgency: SanketUrgency
  category: SanketCategory
  location: SanketLocation
  summary: string
  createdAt: string
  reporterName: string
}
