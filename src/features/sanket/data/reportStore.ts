import { sampleReports } from './sampleReports.ts'
import type { EmergencyDispatchNotification, SanketReport, SanketReportDraft, SanketStatus, SanketStatusHistoryEntry, SanketUrgency } from '../types'

const prototypeReports: SanketReport[] = [...sampleReports]
const lifecycleOrder: SanketStatus[] = ['submitted', 'incoming', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed']

const emergencyNotifications: EmergencyDispatchNotification[] = [
  {
    id: 'DISP-SNK-9101',
    reportId: 'SNK-9101',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    threat: 'flooding',
    summary: 'EMERGENCY SOS: Flash flood trapped family and neighbors on roof',
    details: 'Water entered houses reaching 5 feet. 8 people trapped on rooftop near Kundapura bridge. GNSS Fix active.',
    location: {
      locality: 'Basrur Road',
      taluk: 'Kundapura',
      district: 'Udupi',
      latitude: 13.6352,
      longitude: 74.7088,
      accuracy: 8,
    },
    reporter: {
      name: 'Suresh Bhat',
      phone: '+91 98451 23456',
    },
    acknowledged: false,
  },
]

type DispatchListener = (notification: EmergencyDispatchNotification) => void
const dispatchListeners = new Set<DispatchListener>()

const isValidTransition = (from: SanketStatus, to: SanketStatus) => {
  const fromIndex = lifecycleOrder.indexOf(from)
  const toIndex = lifecycleOrder.indexOf(to)

  if (fromIndex === -1 || toIndex === -1) {
    return false
  }

  return toIndex >= fromIndex && toIndex - fromIndex <= 1
}

const makeReportId = () => {
  const prefix = 'SNK'
  let randomPart = Math.floor(Math.random() * 9000 + 1000)
  let id = `${prefix}-${randomPart}`

  while (prototypeReports.some((report) => report.id === id)) {
    randomPart = Math.floor(Math.random() * 9000 + 1000)
    id = `${prefix}-${randomPart}`
  }

  return id
}

const appendStatusHistory = (report: SanketReport, from: SanketStatus, to: SanketStatus, by: string, note?: string) => {
  const entry: SanketStatusHistoryEntry = {
    from,
    to,
    at: new Date().toISOString(),
    by,
    note,
  }
  report.assignmentHistory = [...(report.assignmentHistory ?? []), entry]
}

export const reportStore = {
  getAll() {
    return prototypeReports
  },

  getQueue() {
    return prototypeReports.filter((report) => report.status !== 'draft' && report.status !== 'closed')
  },

  add(reportDraft: SanketReportDraft): SanketReport {
    const now = new Date().toISOString()
    const newReport: SanketReport = {
      id: makeReportId(),
      reportType: reportDraft.reportType,
      category: reportDraft.category,
      urgency: reportDraft.urgency,
      status: 'incoming',
      createdAt: now,
      updatedAt: now,
      location: {
        ...reportDraft.location,
        label: reportDraft.location.label || 'Unverified location',
      },
      reporter: {
        ...reportDraft.reporter,
      },
      reportedImpacts: { ...reportDraft.reportedImpacts },
      assistanceNeeds: reportDraft.assistanceNeeds,
      summary: reportDraft.summary,
      details: reportDraft.details,
      assignedTo: undefined,
      assignmentHistory: [{
        from: 'submitted',
        to: 'incoming',
        at: now,
        by: 'Prototype queue',
        note: 'Citizen report accepted in the prototype store.',
      }],
      provenance: {
        sourceMode: 'prototype',
        sourceLabel: 'Prototype browser store',
        note: 'This frontend prototype does not send or store data on a live backend.',
      },
      originKind: 'user_submission',
      verificationStatus: 'unverified',
    }

    prototypeReports.unshift(newReport)

    if (reportDraft.reportType === 'sos' || reportDraft.urgency === 'critical') {
      const notification: EmergencyDispatchNotification = {
        id: `DISP-${newReport.id}`,
        reportId: newReport.id,
        timestamp: now,
        threat: reportDraft.category,
        summary: reportDraft.summary,
        details: reportDraft.details,
        location: {
          locality: reportDraft.location.locality || 'Udupi District Sector',
          taluk: reportDraft.location.taluk || 'Udupi',
          district: reportDraft.location.district || 'Udupi',
          latitude: reportDraft.location.latitude ?? 13.3408,
          longitude: reportDraft.location.longitude ?? 74.7421,
          accuracy: 12,
        },
        reporter: {
          name: reportDraft.reporter.name || 'Citizen Distress Caller',
          phone: reportDraft.reporter.phone || '+91 94812 99999',
        },
        acknowledged: false,
      }
      emergencyNotifications.unshift(notification)
      dispatchListeners.forEach((listener) => {
        try {
          listener(notification)
        } catch {
          // ignore
        }
      })
    }

    return newReport
  },

  getById(id: string) {
    return prototypeReports.find((report) => report.id === id) ?? null
  },

  assignReport(id: string, helperName: string, note?: string) {
    const report = prototypeReports.find((item) => item.id === id)
    if (!report) return null

    const previousStatus = report.status
    if (!isValidTransition(previousStatus, 'assigned')) {
      return null
    }

    report.assignedTo = helperName
    report.status = 'assigned'
    report.canAccessContact = true
    report.updatedAt = new Date().toISOString()
    appendStatusHistory(report, previousStatus, 'assigned', helperName, note ?? 'Assigned to a helper for follow-up.')
    return report
  },

  updateStatus(id: string, status: SanketStatus, actor: string, note?: string) {
    const report = prototypeReports.find((item) => item.id === id)
    if (!report) return null

    const previousStatus = report.status
    if (!isValidTransition(previousStatus, status)) {
      return null
    }

    report.status = status
    report.updatedAt = new Date().toISOString()
    appendStatusHistory(report, previousStatus, status, actor, note)
    return report
  },

  updateUrgency(id: string, urgency: SanketUrgency) {
    const report = prototypeReports.find((item) => item.id === id)
    if (!report) return null

    report.urgency = urgency
    report.updatedAt = new Date().toISOString()
    return report
  },

  updateVerification(id: string, status: SanketReport['verificationStatus']) {
    const report = prototypeReports.find((item) => item.id === id)
    if (!report) return null

    report.verificationStatus = status
    report.updatedAt = new Date().toISOString()
    return report
  },

  getEmergencyNotifications(): EmergencyDispatchNotification[] {
    return [...emergencyNotifications]
  },

  subscribeEmergency(listener: DispatchListener): () => void {
    dispatchListeners.add(listener)
    return () => dispatchListeners.delete(listener)
  },

  acknowledgeEmergency(id: string, helperName?: string) {
    const item = emergencyNotifications.find((n) => n.id === id || n.reportId === id)
    if (item) {
      item.acknowledged = true
      item.acknowledgedBy = helperName || 'SAR Team Alpha'
      item.acknowledgedAt = new Date().toISOString()
    }
  },
}
