import type { SanketLocation } from '../sanket/types'

export type CampStatus = 'open' | 'near_capacity' | 'full' | 'closed'

export type ReliefSupplyCategory =
  | 'food_water'
  | 'medical_aid'
  | 'bedding_clothing'
  | 'hygiene_sanitation'
  | 'infant_care'
  | 'tools_clearance'

export interface ReliefCamp {
  id: string
  name: string
  taluk: string
  address: string
  location: SanketLocation
  managerName: string
  managerPhone: string
  capacity: number
  currentOccupancy: number
  status: CampStatus
  facilities: string[]
  urgentlyNeeded: ReliefSupplyCategory[]
  lastUpdated: string
}

export interface SupplyItem {
  id: string
  campId: string
  campName: string
  category: ReliefSupplyCategory
  itemName: string
  quantity: number
  unit: string
  status: 'sufficient' | 'low' | 'critical'
  lastRestocked: string
}

export type RehabClaimType =
  | 'house_damage'
  | 'crop_livestock'
  | 'livelihood_equipment'
  | 'document_loss'
  | 'disinfection_repair'

export type RehabStatus = 'submitted' | 'under_review' | 'inspected' | 'approved' | 'disbursed' | 'rejected'

export interface RehabRequest {
  id: string
  claimantName: string
  claimantPhone: string
  claimantAadhaarLast4?: string
  taluk: string
  locality: string
  claimType: RehabClaimType
  estimatedLossInr?: number
  description: string
  status: RehabStatus
  inspectorAssigned?: string
  approvalNotes?: string
  createdAt: string
  updatedAt: string
}

export interface SafeCheckin {
  id: string
  fullName: string
  age?: number
  gender?: 'male' | 'female' | 'other'
  homeLocality: string
  campId: string
  campName: string
  contactPhone: string
  familyMembersCount: number
  checkedInAt: string
  status: 'safe_in_camp' | 'relocated'
}

