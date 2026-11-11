import { apiRequest, isBackendConnected } from '../../../lib/apiClient.ts'
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

interface PunarjeevStatePayload {
  camps: ReliefCamp[]
  supplies: SupplyItem[]
  checkins: SafeCheckin[]
  rehabs: RehabRequest[]
}

export const punarjeevRepository = {
  async getCamps(): Promise<ReliefCamp[]> {
    if (isBackendConnected()) {
      try {
        const data = await apiRequest<PunarjeevStatePayload>('/api/punarjeev')
        return data.camps
      } catch {
        // Fallback in standalone local preview/dev
      }
    }
    return punarjeevStore.getCamps()
  },

  async getCamp(id: string): Promise<ReliefCamp | undefined> {
    const camps = await this.getCamps()
    return camps.find((c) => c.id === id)
  },

  async updateCampOccupancy(campId: string, occupancy: number): Promise<ReliefCamp> {
    if (isBackendConnected()) {
      const result = await apiRequest<{ camp: ReliefCamp }>('/api/punarjeev', {
        method: 'PATCH',
        body: JSON.stringify({ kind: 'camp_occupancy', campId, occupancy }),
      })
      return result.camp
    }
    return punarjeevStore.updateCampOccupancy(campId, occupancy)
  },

  async getSupplies(): Promise<SupplyItem[]> {
    if (isBackendConnected()) {
      try {
        const data = await apiRequest<PunarjeevStatePayload>('/api/punarjeev')
        return data.supplies
      } catch {
        // Fallback
      }
    }
    return punarjeevStore.getSupplies()
  },

  async requestSupply(params: {
    campId: string
    category: ReliefSupplyCategory
    itemName: string
    quantity: number
    unit: string
  }): Promise<SupplyItem> {
    if (isBackendConnected()) {
      const result = await apiRequest<{ supply: SupplyItem }>('/api/punarjeev', {
        method: 'POST',
        body: JSON.stringify({ kind: 'supply_request', ...params }),
      })
      return result.supply
    }
    return punarjeevStore.requestSupply(params)
  },

  async getSafeCheckins(): Promise<SafeCheckin[]> {
    if (isBackendConnected()) {
      try {
        const data = await apiRequest<PunarjeevStatePayload>('/api/punarjeev')
        return data.checkins
      } catch {
        // Fallback
      }
    }
    return punarjeevStore.getSafeCheckins()
  },

  async searchSafeCheckins(query: string): Promise<SafeCheckin[]> {
    if (isBackendConnected()) {
      try {
        const encoded = encodeURIComponent(query.trim())
        const data = await apiRequest<PunarjeevStatePayload>(`/api/punarjeev?q=${encoded}`)
        return data.checkins
      } catch {
        // Fallback
      }
    }
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
    if (isBackendConnected()) {
      const result = await apiRequest<{ checkin: SafeCheckin }>('/api/punarjeev', {
        method: 'POST',
        body: JSON.stringify({ kind: 'checkin', ...data }),
      })
      return result.checkin
    }
    return punarjeevStore.addSafeCheckin(data)
  },

  async getRehabRequests(): Promise<RehabRequest[]> {
    if (isBackendConnected()) {
      try {
        const data = await apiRequest<PunarjeevStatePayload>('/api/punarjeev')
        return data.rehabs
      } catch {
        // Fallback
      }
    }
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
    if (isBackendConnected()) {
      const result = await apiRequest<{ request: RehabRequest }>('/api/punarjeev', {
        method: 'POST',
        body: JSON.stringify({ kind: 'rehab_claim', ...data }),
      })
      return result.request
    }
    return punarjeevStore.submitRehabRequest(data)
  },

  async updateRehabStatus(id: string, status: RehabStatus, notes?: string): Promise<RehabRequest> {
    if (isBackendConnected()) {
      const result = await apiRequest<{ request: RehabRequest }>('/api/punarjeev', {
        method: 'PATCH',
        body: JSON.stringify({ kind: 'rehab_status', id, status, notes }),
      })
      return result.request
    }
    return punarjeevStore.updateRehabStatus(id, status, notes)
  },
}
