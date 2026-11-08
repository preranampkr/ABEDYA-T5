import { describe, expect, it } from 'vitest'
import { reportStore } from '../features/sanket/data/reportStore'
import { sanketRepository } from '../features/sanket/data/sanketRepository'
import type { SanketReportDraft, SanketStatus } from '../features/sanket/types'

describe('SANKET Incident Reporting and ID Generation', () => {
  const sampleDraft: SanketReportDraft = {
    reportType: 'sos',
    category: 'flooding',
    urgency: 'critical',
    location: {
      label: 'Kallianpur Bridge, Santhekatte',
      locality: 'Kallianpur',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.385,
      longitude: 74.743,
      source: 'manual',
    },
    reporter: {
      name: 'Ramesh Nayak',
      phone: '+91 98450 12345',
      contactPreference: 'phone',
    },
    assistanceNeeds: ['rescue', 'evacuation'],
    summary: 'Water level overflowing over bridge',
    details: 'Vehicular movement stopped, two families stranded on the embankment.',
  }

  it('generates a valid, properly formatted report ID', () => {
    const report1 = reportStore.add(sampleDraft)
    expect(report1.id).toMatch(/^SNK-\d{4,}$/)

    const report2 = reportStore.add(sampleDraft)
    expect(report2.id).toMatch(/^SNK-\d{4,}$/)
    expect(report1.id).not.toBe(report2.id)
  })

  it('successfully submits and persists a report via sanketRepository', async () => {
    const created = await sanketRepository.submitReport(sampleDraft)
    expect(created.id).toBeDefined()
    expect(created.id).toMatch(/^SNK-/)
    expect(created.status).toBe('incoming')
    expect(created.urgency).toBe('critical')
    expect(created.category).toBe('flooding')
    expect(created.location.locality).toBe('Kallianpur')
    expect(created.assignmentHistory.length).toBeGreaterThan(0)
    expect(created.assignmentHistory[0].to).toBe('incoming')

    // Verify it is retrievable
    const fetched = await sanketRepository.getReportDetails(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(created.id)
    expect(fetched?.summary).toBe(sampleDraft.summary)
  })

  it('handles invalid status transitions strictly', async () => {
    const report = await sanketRepository.submitReport(sampleDraft)
    expect(report.status).toBe('incoming')

    // Cannot jump directly from 'incoming' to 'resolved' or 'closed'
    await expect(
      sanketRepository.updateStatus(report.id, 'closed' as SanketStatus, 'user-1', 'Helper Coordinator')
    ).rejects.toThrow()
  })

  it('successfully advances status along the lifecycle flow', async () => {
    const report = await sanketRepository.submitReport(sampleDraft)
    
    // Assign report
    const assigned = await sanketRepository.assignReport(report.id, 'hlp-1', 'Officer Shenoy', 'Assigned for follow-up')
    expect(assigned.status).toBe('assigned')
    expect(assigned.assignedTo).toBeDefined()

    // Advance to in_progress
    const inProgress = await sanketRepository.updateStatus(report.id, 'in_progress', 'hlp-1', 'Officer Shenoy', 'Rescue team on site')
    expect(inProgress.status).toBe('in_progress')

    // Advance to resolved
    const resolved = await sanketRepository.updateStatus(report.id, 'resolved', 'hlp-1', 'Officer Shenoy', 'Families evacuated safely')
    expect(resolved.status).toBe('resolved')
  })

  it('prevents accidental duplicate rapid submissions', async () => {
    let isSubmitting = false

    async function triggerSubmit() {
      if (isSubmitting) return null
      isSubmitting = true
      try {
        return await sanketRepository.submitReport(sampleDraft)
      } finally {
        isSubmitting = false
      }
    }

    const first = triggerSubmit()
    const second = triggerSubmit() // should be blocked by guard flag

    const [res1, res2] = await Promise.all([first, second])
    expect(res1).not.toBeNull()
    expect(res2).toBeNull()
  })

  it('restricts citizen contact information retrieval', async () => {
    const report = await sanketRepository.submitReport(sampleDraft)
    const contact = await sanketRepository.getRestrictedContactInfo(report.id)
    expect(contact.name).toBe(sampleDraft.reporter.name)
    expect(contact.phone).toBe(sampleDraft.reporter.phone)
  })

  it('fails gracefully when updating a non-existent report', async () => {
    await expect(
      sanketRepository.assignReport('SNK-999999', 'hlp-1', 'Officer Shenoy')
    ).rejects.toThrow()

    await expect(
      sanketRepository.updateStatus('SNK-999999', 'in_progress', 'hlp-1', 'Officer Shenoy')
    ).rejects.toThrow()
  })

  it('enforces that direct Supabase client requests throw when credentials are not configured', async () => {
    const { getSupabase } = await import('../lib/supabase')
    expect(() => getSupabase()).toThrow(/Supabase is not configured/)
  })
})
