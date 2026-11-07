import { medhaRepository } from '../../medha/data/repository'
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

    const previewList = senaStore.getPreviewIncidents()
    // Deduplicate in case any incident IDs overlap
    const handoffIds = new Set(handoffIncidents.map((i) => i.id))
    const additionalPreview = previewList.filter((item) => !handoffIds.has(item.id))

    return [...handoffIncidents, ...additionalPreview]
  },

  getUnits(): ResponseUnit[] {
    return senaStore.getUnits()
  },

  async dispatchUnit(params: {
    incidentId: string
    unitId: string
    priority: MedhaPriority
    missionBrief: string
    assignedBy: string
  }): Promise<DispatchOrder> {
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
    return senaStore.updateDispatchStage(params)
  },

  async addLog(incidentId: string, text: string, by: string): Promise<FieldLogEntry> {
    return senaStore.appendFieldLog(incidentId, text, by)
  },
}
