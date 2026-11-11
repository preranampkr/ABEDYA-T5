import { apiRequest, isBackendConnected } from '../../../lib/apiClient.ts'
import { medhaRepository } from '../../medha/data/repository.ts'
import { senaStore } from './senaStore.ts'
import type { DispatchOrder, FieldLogEntry, ResponseUnit, SenaDispatchStatus, SenaIncidentItem } from '../types'
import type { MedhaPriority } from '../../medha/data/intelligence'

export const senaRepository = {
  async getIncidents(): Promise<SenaIncidentItem[]> {
    let handoffIncidents: SenaIncidentItem[] = []
    try {
      const handoffs = await medhaRepository.getSenaHandoff()
      if (handoffs && handoffs.length > 0) {
        handoffIncidents = handoffs.map((h) => senaStore.convertHandoffToItem(h))
      }
    } catch {
      // Local preview fallback
    }

    if (isBackendConnected()) {
      try {
        const state = await apiRequest<{ units: ResponseUnit[]; dispatches: DispatchOrder[] }>('/api/sena')
        const dispatchByIncident = new Map(state.dispatches.map((order) => [order.incidentId, order]))
        return handoffIncidents.map((item) => ({
          ...item,
          activeDispatch: dispatchByIncident.get(item.id) ?? item.activeDispatch,
        }))
      } catch {
        // Fall through to local preview fallback if Vercel /api is unavailable (e.g. standalone vite dev)
      }
    }

    const previewList = senaStore.getPreviewIncidents()
    const handoffIds = new Set(handoffIncidents.map((i) => i.id))
    const additionalPreview = previewList.filter((item) => !handoffIds.has(item.id))

    return [...handoffIncidents, ...additionalPreview]
  },

  async getUnits(): Promise<ResponseUnit[]> {
    if (isBackendConnected()) {
      try {
        const state = await apiRequest<{ units: ResponseUnit[]; dispatches: DispatchOrder[] }>('/api/sena')
        if (Array.isArray(state.units) && state.units.length > 0) {
          return state.units
        }
      } catch {
        // Fallback when standalone dev server runs without /api
      }
    }
    return senaStore.getUnits()
  },

  async dispatchUnit(params: {
    incidentId: string
    unitId: string
    priority: MedhaPriority
    missionBrief: string
    assignedBy: string
  }): Promise<DispatchOrder> {
    if (isBackendConnected()) {
      const result = await apiRequest<{ order: DispatchOrder }>('/api/sena', {
        method: 'POST',
        body: JSON.stringify({ action: 'dispatch', ...params }),
      })
      return result.order
    }
    return senaStore.dispatchTeam(params)
  },

  async updateStage(params: {
    incidentId: string
    status: SenaDispatchStatus
    updatedBy: string
    note: string
    outcome?: {
      rescuedCount?: number
      assistedCount?: number
      notes?: string
    }
  }): Promise<DispatchOrder> {
    if (isBackendConnected()) {
      const result = await apiRequest<{ order: DispatchOrder }>('/api/sena', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'stage', ...params }),
      })
      return result.order
    }
    return senaStore.updateDispatchStage(params)
  },

  async addLog(incidentId: string, text: string, by: string): Promise<FieldLogEntry> {
    if (isBackendConnected()) {
      const result = await apiRequest<{ entry: FieldLogEntry }>('/api/sena', {
        method: 'POST',
        body: JSON.stringify({ action: 'log', incidentId, text, by }),
      })
      return result.entry
    }
    return senaStore.appendFieldLog(incidentId, text, by)
  },
}
