import {
  sampleCamps,
  sampleRehabRequests,
  sampleSafeCheckins,
  sampleSupplies,
} from './sampleCamps.ts'
import type {
  CampStatus,
  RehabClaimType,
  RehabRequest,
  RehabStatus,
  ReliefCamp,
  ReliefSupplyCategory,
  SafeCheckin,
  SupplyItem,
} from '../types'

class PunarjeevStore {
  private camps: ReliefCamp[] = JSON.parse(JSON.stringify(sampleCamps))
  private supplies: SupplyItem[] = JSON.parse(JSON.stringify(sampleSupplies))
  private checkins: SafeCheckin[] = JSON.parse(JSON.stringify(sampleSafeCheckins))
  private rehabs: RehabRequest[] = JSON.parse(JSON.stringify(sampleRehabRequests))

  getCamps(): ReliefCamp[] {
    return [...this.camps]
  }

  getCamp(id: string): ReliefCamp | undefined {
    return this.camps.find((c) => c.id === id)
  }

  updateCampOccupancy(campId: string, currentOccupancy: number): ReliefCamp {
    const camp = this.camps.find((c) => c.id === campId)
    if (!camp) throw new Error(`Camp ${campId} not found`)

    camp.currentOccupancy = Math.max(0, currentOccupancy)
    const ratio = camp.currentOccupancy / camp.capacity
    let status: CampStatus = 'open'
    if (ratio >= 1.0) status = 'full'
    else if (ratio >= 0.85) status = 'near_capacity'

    camp.status = status
    camp.lastUpdated = new Date().toISOString()
    return camp
  }

  getSupplies(): SupplyItem[] {
    return [...this.supplies]
  }

  requestSupply(params: {
    campId: string
    category: ReliefSupplyCategory
    itemName: string
    quantity: number
    unit: string
  }): SupplyItem {
    const camp = this.camps.find((c) => c.id === params.campId)
    const campName = camp ? camp.name : 'Emergency Shelter'

    const newItem: SupplyItem = {
      id: `SUP-${Math.floor(100 + Math.random() * 900)}`,
      campId: params.campId,
      campName,
      category: params.category,
      itemName: params.itemName,
      quantity: params.quantity,
      unit: params.unit,
      status: 'critical',
      lastRestocked: new Date().toISOString(),
    }

    this.supplies.unshift(newItem)
    return newItem
  }

  getSafeCheckins(): SafeCheckin[] {
    return [...this.checkins]
  }

  searchSafeCheckins(query: string): SafeCheckin[] {
    const q = query.trim().toLowerCase()
    if (!q) return [...this.checkins]
    return this.checkins.filter((item) => {
      const matchName = item.fullName.toLowerCase().includes(q)
      const matchPhone = item.contactPhone.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))
      const matchLoc = item.homeLocality.toLowerCase().includes(q)
      const matchCamp = item.campName.toLowerCase().includes(q)
      return matchName || matchPhone || matchLoc || matchCamp
    })
  }

  addSafeCheckin(data: {
    fullName: string
    age?: number
    gender?: 'male' | 'female' | 'other'
    homeLocality: string
    campId: string
    contactPhone: string
    familyMembersCount: number
  }): SafeCheckin {
    const camp = this.camps.find((c) => c.id === data.campId)
    const campName = camp ? camp.name : 'Designated Shelter'

    const checkin: SafeCheckin = {
      id: `CHK-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: data.fullName.trim(),
      age: data.age,
      gender: data.gender,
      homeLocality: data.homeLocality.trim(),
      campId: data.campId,
      campName,
      contactPhone: data.contactPhone.trim(),
      familyMembersCount: Math.max(1, data.familyMembersCount || 1),
      checkedInAt: new Date().toISOString(),
      status: 'safe_in_camp',
    }

    this.checkins.unshift(checkin)

    // Increment camp occupancy if matched
    if (camp) {
      this.updateCampOccupancy(camp.id, camp.currentOccupancy + checkin.familyMembersCount)
    }

    return checkin
  }

  getRehabRequests(): RehabRequest[] {
    return [...this.rehabs]
  }

  submitRehabRequest(data: {
    claimantName: string
    claimantPhone: string
    claimantAadhaarLast4?: string
    taluk: string
    locality: string
    claimType: RehabClaimType
    estimatedLossInr?: number
    description: string
  }): RehabRequest {
    const now = new Date().toISOString()
    const request: RehabRequest = {
      id: `RHB-${Math.floor(100 + Math.random() * 900)}`,
      claimantName: data.claimantName.trim(),
      claimantPhone: data.claimantPhone.trim(),
      claimantAadhaarLast4: data.claimantAadhaarLast4?.trim(),
      taluk: data.taluk.trim(),
      locality: data.locality.trim(),
      claimType: data.claimType,
      estimatedLossInr: data.estimatedLossInr,
      description: data.description.trim(),
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    }

    this.rehabs.unshift(request)
    return request
  }

  updateRehabStatus(id: string, status: RehabStatus, notes?: string): RehabRequest {
    const req = this.rehabs.find((r) => r.id === id)
    if (!req) throw new Error(`Rehab claim ${id} not found`)

    req.status = status
    if (notes) req.approvalNotes = notes.trim()
    req.updatedAt = new Date().toISOString()
    return req
  }
}

export const punarjeevStore = new PunarjeevStore()
