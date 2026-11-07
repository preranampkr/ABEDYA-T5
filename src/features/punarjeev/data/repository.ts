import { punarjeevStore } from './punarjeevStore.ts'
import type {
  RehabClaimType,
  RehabRequest,
  RehabStatus,
  ReliefCamp,
  ReliefSupplyCategory,
  SafeCheckin,
  SupplyItem,
} from '../types'

export const punarjeevRepository = {
  async getCamps(): Promise<ReliefCamp[]> {
    return punarjeevStore.getCamps()
  },

  async getCamp(id: string): Promise<ReliefCamp | undefined> {
    return punarjeevStore.getCamp(id)
  },

  async updateCampOccupancy(campId: string, occupancy: number): Promise<ReliefCamp> {
    return punarjeevStore.updateCampOccupancy(campId, occupancy)
  },

  async getSupplies(): Promise<SupplyItem[]> {
    return punarjeevStore.getSupplies()
  },

  async requestSupply(params: {
    campId: string
    category: ReliefSupplyCategory
    itemName: string
    quantity: number
    unit: string
  }): Promise<SupplyItem> {
    return punarjeevStore.requestSupply(params)
  },

  async getSafeCheckins(): Promise<SafeCheckin[]> {
    return punarjeevStore.getSafeCheckins()
  },

  async searchSafeCheckins(query: string): Promise<SafeCheckin[]> {
    return punarjeevStore.searchSafeCheckins(query)
  },

  async addSafeCheckin(data: {
    fullName: string
    age?: number
    gender?: 'male' | 'female' | 'other'
    homeLocality: string
    campId: string
    contactPhone: string
    familyMembersCount: number
  }): Promise<SafeCheckin> {
    return punarjeevStore.addSafeCheckin(data)
  },

  async getRehabRequests(): Promise<RehabRequest[]> {
    return punarjeevStore.getRehabRequests()
  },

  async submitRehabRequest(data: {
    claimantName: string
    claimantPhone: string
    claimantAadhaarLast4?: string
    taluk: string
    locality: string
    claimType: RehabClaimType
    estimatedLossInr?: number
    description: string
  }): Promise<RehabRequest> {
    return punarjeevStore.submitRehabRequest(data)
  },

  async updateRehabStatus(id: string, status: RehabStatus, notes?: string): Promise<RehabRequest> {
    return punarjeevStore.updateRehabStatus(id, status, notes)
  },
}

