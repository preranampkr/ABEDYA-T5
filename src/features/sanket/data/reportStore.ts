import { sampleReports } from './sampleReports.ts'
import type { SanketReport, SanketReportDraft, SanketStatus, SanketStatusHistoryEntry, SanketUrgency } from '../types'

const prototypeReports: SanketReport[] = [...sampleReports]
const lifecycleOrder: SanketStatus[] = ['incoming', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed']

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
    }

    prototypeReports.unshift(newReport)
    return newReport
  },

  getById(id: string) {
    return prototypeReports.find((report) => report.id === id) ?? null
  },

  assignReport(id: string, helperName: string, note?: string) {
    const report = prototypeReports.find((item) => item.id === id)
    if (!report) return null

    const previousStatus = report.status
    if (previousStatus !== 'incoming' && previousStatus !== 'under_review' && previousStatus !== 'assigned') {
      return null
    }

    report.assignedTo = helperName
    report.status = 'assigned'
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
}
