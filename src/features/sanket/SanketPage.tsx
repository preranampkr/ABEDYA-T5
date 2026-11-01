import { AlertTriangle, CheckCircle2, Clock3, FileText, MapPin, Radio, ShieldAlert, UserRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { reportStore } from './data/reportStore'
import type { SanketAssistanceNeed, SanketCategory, SanketReportDraft, SanketReportType, SanketStatus, SanketUrgency } from './types'
import './sanket.css'

const incidentTypes: { value: SanketReportType; label: string; description: string }[] = [
  { value: 'sos', label: 'SOS', description: 'Immediate help needed' },
  { value: 'incident', label: 'Incident', description: 'Report what happened' },
  { value: 'assistance', label: 'Assistance', description: 'Request specific support' },
]

const categories: { value: SanketCategory; label: string }[] = [
  { value: 'flooding', label: 'Flooding' },
  { value: 'waterlogging', label: 'Waterlogging' },
  { value: 'blocked_road', label: 'Blocked road' },
  { value: 'damaged_infrastructure', label: 'Damaged infrastructure' },
  { value: 'medical_assistance', label: 'Medical assistance' },
  { value: 'shelter_required', label: 'Shelter required' },
  { value: 'food_water', label: 'Food and essential supplies' },
  { value: 'other', label: 'Other' },
]

const urgencyLevels: { value: SanketUrgency; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const assistanceOptions: { value: SanketAssistanceNeed; label: string }[] = [
  { value: 'rescue', label: 'Rescue' },
  { value: 'medical', label: 'Medical' },
  { value: 'evacuation', label: 'Evacuation' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'food_water', label: 'Food and water' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
]

const statusFlow: SanketStatus[] = ['incoming', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed']

const defaultDraft: SanketReportDraft = {
  reportType: 'incident',
  category: 'flooding',
  urgency: 'medium',
  location: {
    label: 'Current or nearby location',
    locality: '',
    taluk: '',
    district: 'Udupi',
    source: 'manual',
  },
  reporter: {
    name: '',
    phone: '',
    contactPreference: 'phone',
  },
  assistanceNeeds: ['food_water'],
  summary: '',
  details: '',
}

function SanketPage({ role = 'victim' }: { role?: 'victim' | 'helper' }) {
  const [draft, setDraft] = useState<SanketReportDraft>(defaultDraft)
  const [validationError, setValidationError] = useState('')
  const [submittedReportId, setSubmittedReportId] = useState('')
  const [reports, setReports] = useState(reportStore.getAll())
  const [helperStatusFilter, setHelperStatusFilter] = useState<'all' | SanketStatus>('all')
  const [helperUrgencyFilter, setHelperUrgencyFilter] = useState<'all' | SanketUrgency>('all')
  const [helperCategoryFilter, setHelperCategoryFilter] = useState<'all' | SanketCategory>('all')
  const [helperAssignedFilter, setHelperAssignedFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [helperLocationFilter, setHelperLocationFilter] = useState('')
  const [citizenView, setCitizenView] = useState<'report' | 'assistance' | 'history'>('report')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(reportStore.getAll()[0]?.id ?? null)

  const helperQueue = useMemo(() => {
    const all = reports.length > 0 ? reportStore.getQueue() : []
    return all.filter((report) => {
      const statusMatches = helperStatusFilter === 'all' || report.status === helperStatusFilter
      const urgencyMatches = helperUrgencyFilter === 'all' || report.urgency === helperUrgencyFilter
      const categoryMatches = helperCategoryFilter === 'all' || report.category === helperCategoryFilter
      const assignmentMatches =
        helperAssignedFilter === 'all' ||
        (helperAssignedFilter === 'assigned' ? Boolean(report.assignedTo) : !report.assignedTo)
      const locationMatches =
        !helperLocationFilter ||
        [report.location.locality, report.location.taluk, report.location.district, report.location.label]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(helperLocationFilter.toLowerCase()))

      return statusMatches && urgencyMatches && categoryMatches && assignmentMatches && locationMatches
    })
  }, [helperAssignedFilter, helperCategoryFilter, helperLocationFilter, helperStatusFilter, helperUrgencyFilter, reports])

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? helperQueue[0] ?? reports[0] ?? null,
    [helperQueue, reports, selectedReportId],
  )

  const previewQueue = useMemo(() => [...reports].slice(0, 3), [reports])

  function updateDraft<K extends keyof SanketReportDraft>(key: K, value: SanketReportDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateLocation<K extends keyof SanketReportDraft['location']>(key: K, value: SanketReportDraft['location'][K]) {
    setDraft((current) => ({
      ...current,
      location: { ...current.location, [key]: value },
    }))
  }

  function updateReporter<K extends keyof SanketReportDraft['reporter']>(key: K, value: SanketReportDraft['reporter'][K]) {
    setDraft((current) => ({
      ...current,
      reporter: { ...current.reporter, [key]: value },
    }))
  }

  function toggleAssistance(value: SanketAssistanceNeed) {
    setDraft((current) => {
      const exists = current.assistanceNeeds.includes(value)
      return {
        ...current,
        assistanceNeeds: exists
          ? current.assistanceNeeds.filter((item) => item !== value)
          : [...current.assistanceNeeds, value],
      }
    })
  }

  function validateDraft() {
    if (!draft.summary.trim()) return 'Add a brief incident summary.'
    if (!draft.details.trim()) return 'Add a few more details about the situation.'
    if (!draft.reporter.name.trim()) return 'Add the reporter name.'
    if (!draft.reporter.phone.trim()) return 'Add a contact number.'
    if (!draft.location.locality.trim()) return 'Add the locality or nearby place name.'
    if (!draft.location.taluk.trim()) return 'Add the taluk name.'
    return ''
  }

  function refreshReports() {
    const next = reportStore.getAll()
    setReports(next)
    if (selectedReportId && !next.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(next[0]?.id ?? null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const error = validateDraft()
    if (error) {
      setValidationError(error)
      return
    }

    const newReport = reportStore.add(draft)
    setSubmittedReportId(newReport.id)
    setValidationError('')
    setCitizenView('history')
    refreshReports()
    setDraft({ ...defaultDraft, reportType: draft.reportType, urgency: draft.urgency })
  }

  function handleHelperStatus(status: SanketStatus, note?: string) {
    if (!selectedReport) return
    const next = reportStore.updateStatus(selectedReport.id, status, 'Helper workflow', note)
    if (!next) return
    refreshReports()
  }

  function handleAssignment() {
    if (!selectedReport) return
    const next = reportStore.assignReport(selectedReport.id, 'Helper M. Rao', 'Assigned from prototype helper queue.')
    if (!next) return
    refreshReports()
  }

  const allowedStatuses = selectedReport ? statusFlow.slice(statusFlow.indexOf(selectedReport.status) + 1) : []

  if (role === 'helper') {
    const nextStatus = allowedStatuses[0]

    return (
      <DashboardLayout role={role} title="SANKET" description="Incoming citizen reports and triage workflow." eyebrow={`${role.toUpperCase()} MODULE / SANKET`}>
        <div className="sanket-page helper-workflow">
          <section className="sanket-topbar">
            <div>
              <p className="eyebrow">HELPER REVIEW / PROTOTYPE</p>
              <h2>Incident queue and triage</h2>
            </div>
            <div className="sanket-status">
              <span className="status-dot status-warning" />
              Prototype workflow
            </div>
          </section>

          <div className="helper-layout">
            <aside className="sanket-panel helper-queue-panel">
              <div className="sanket-panel-header">
                <div>
                  <p className="eyebrow">INCOMING REPORTS</p>
                  <h3>Queue</h3>
                </div>
                <select className="queue-filter" value={helperStatusFilter} onChange={(event) => setHelperStatusFilter(event.target.value as 'all' | SanketStatus)}>
                  <option value="all">All statuses</option>
                  {statusFlow.map((status) => (
                    <option key={status} value={status}>{formatStatus(status)}</option>
                  ))}
                </select>
              </div>

              <div className="helper-filter-grid">
                <select value={helperUrgencyFilter} onChange={(event) => setHelperUrgencyFilter(event.target.value as 'all' | SanketUrgency)}>
                  <option value="all">All urgencies</option>
                  {urgencyLevels.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <select value={helperCategoryFilter} onChange={(event) => setHelperCategoryFilter(event.target.value as 'all' | SanketCategory)}>
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <select value={helperAssignedFilter} onChange={(event) => setHelperAssignedFilter(event.target.value as 'all' | 'assigned' | 'unassigned')}>
                  <option value="all">All assignments</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
                <input
                  value={helperLocationFilter}
                  onChange={(event) => setHelperLocationFilter(event.target.value)}
                  placeholder="Filter by location"
                />
              </div>

              <div className="queue-list">
                {helperQueue.length ? (
                  helperQueue.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      className={`queue-item ${selectedReport?.id === report.id ? 'selected' : ''}`}
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      <div className="queue-topline">
                        <span className="queue-id">{report.id}</span>
                        <span className={`status-pill status-${report.urgency}`}>{report.urgency}</span>
                      </div>
                      <h4>{report.summary}</h4>
                      <p>{report.location.locality} · {report.location.taluk}</p>
                      <div className="queue-meta">
                        <span><AlertTriangle size={12} aria-hidden="true" /> {report.category}</span>
                        <span><UserRound size={12} aria-hidden="true" /> {report.reporter.name}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">No reports match the current filters.</div>
                )}
              </div>
            </aside>

            <main className="sanket-panel helper-detail-panel">
              {selectedReport ? (
                <>
                  <div className="sanket-panel-header">
                    <div>
                      <p className="eyebrow">REPORT REVIEW</p>
                      <h3>{selectedReport.id}</h3>
                    </div>
                    <span className="status-badge status-badge--submitted">{formatStatus(selectedReport.status)}</span>
                  </div>

                  <div className="detail-body">
                    <div className="helper-detail-grid">
                      <section className="detail-card">
                        <h4>Summary</h4>
                        <div className="detail-row"><span>Type</span><strong>{formatReportType(selectedReport.reportType)}</strong></div>
                        <div className="detail-row"><span>Category</span><strong>{selectedReport.category}</strong></div>
                        <div className="detail-row"><span>Urgency</span><strong>{selectedReport.urgency}</strong></div>
                        <div className="detail-row"><span>Status</span><strong>{formatStatus(selectedReport.status)}</strong></div>
                        <div className="detail-row"><span>Assigned</span><strong>{selectedReport.assignedTo ?? 'Unassigned'}</strong></div>
                      </section>

                      <section className="detail-card">
                        <h4>Situation</h4>
                        <p><strong>Summary:</strong> {selectedReport.summary}</p>
                        <p><strong>Details:</strong> {selectedReport.details}</p>
                        <p><strong>Assistance needed:</strong> {selectedReport.assistanceNeeds.length ? selectedReport.assistanceNeeds.map((item) => item.replace(/_/g, ' ')).join(', ') : 'None specified'}</p>
                      </section>

                      <section className="detail-card">
                        <h4>Reporter</h4>
                        <div className="detail-row"><span>Name</span><strong>{selectedReport.reporter.name}</strong></div>
                        <div className="detail-row"><span>Contact</span><strong>{selectedReport.reporter.phone || 'Not provided'}</strong></div>
                        <div className="detail-row"><span>Preference</span><strong>{selectedReport.reporter.contactPreference}</strong></div>
                      </section>

                      <section className="detail-card">
                        <h4>Location</h4>
                        <div className="detail-row"><span>Locality</span><strong>{selectedReport.location.locality}</strong></div>
                        <div className="detail-row"><span>Taluk</span><strong>{selectedReport.location.taluk}</strong></div>
                        <div className="detail-row"><span>District</span><strong>{selectedReport.location.district}</strong></div>
                        <div className="detail-row"><span>Coordinates</span><strong>{selectedReport.location.latitude && selectedReport.location.longitude ? `${selectedReport.location.latitude}, ${selectedReport.location.longitude}` : 'Not available'}</strong></div>
                      </section>

                      <section className="detail-card">
                        <h4>Operational notes</h4>
                        <div className="detail-row"><span>Submitted</span><strong>{formatTimestamp(selectedReport.createdAt)}</strong></div>
                        <div className="detail-row"><span>Updated</span><strong>{formatTimestamp(selectedReport.updatedAt)}</strong></div>
                        <div className="detail-row"><span>Provenance</span><strong>{selectedReport.provenance.sourceLabel}</strong></div>
                        <div className="detail-row"><span>Verification</span><strong>{selectedReport.location.source}</strong></div>
                      </section>

                      <section className="detail-card">
                        <h4>Tracking</h4>
                        <ul className="history-timeline">
                          {selectedReport.assignmentHistory.map((entry) => (
                            <li key={`${selectedReport.id}-${entry.at}-${entry.to}`}>
                              <span>{formatStatus(entry.to)}</span>
                              <small>{formatTimestamp(entry.at)} · {entry.by}</small>
                              {entry.note ? <small>{entry.note}</small> : null}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>

                    <div className="action-stack">
                      {!selectedReport.assignedTo ? (
                        <Button type="button" className="button button-primary" onClick={handleAssignment}>Assign to me</Button>
                      ) : (
                        <Button type="button" className="button button-outline" variant="outline" disabled>
                          Assigned to {selectedReport.assignedTo}
                        </Button>
                      )}
                      {nextStatus ? (
                        <Button
                          type="button"
                          className="button button-outline"
                          variant="outline"
                          onClick={() => handleHelperStatus(nextStatus, `Advanced to ${formatStatus(nextStatus)}`)}
                        >
                          Advance to {formatStatus(nextStatus)}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">No reports available for review.</div>
              )}
            </main>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role={role} title="SANKET" description="Citizen reporting and assistance requests." eyebrow={`${role.toUpperCase()} MODULE / SANKET`}>
      <div className="sanket-page sanket-victim-page">
        <section className="sanket-topbar">
          <div>
            <p className="eyebrow">CITIZEN REPORTING / PROTOTYPE</p>
            <h2>Report and request help</h2>
          </div>
          <div className="sanket-status">
            <span className="status-dot status-warning" />
            Prototype environment
          </div>
        </section>

        <div className="victim-primary-actions">
          {[
            { id: 'report', label: 'Report an incident', description: 'Share what happened' },
            { id: 'assistance', label: 'Request assistance / SOS', description: 'Urgent help or support' },
            { id: 'history', label: 'My reports', description: 'Check your submissions' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`victim-action-card${citizenView === item.id ? ' active' : ''}`}
              onClick={() => {
                setCitizenView(item.id as 'report' | 'assistance' | 'history')
                if (item.id === 'report') {
                  setDraft((current) => ({ ...current, reportType: 'incident' }))
                }
                if (item.id === 'assistance') {
                  setDraft((current) => ({ ...current, reportType: current.reportType === 'incident' ? 'assistance' : current.reportType }))
                }
              }}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        {citizenView === 'history' ? (
          <section className="sanket-panel victim-history-panel">
            <div className="sanket-panel-header">
              <div>
                <p className="eyebrow">REPORT HISTORY</p>
                <h3>My submissions</h3>
              </div>
              <span className="sanket-panel-tag">{reports.length} records</span>
            </div>

            <div className="history-list">
              {reports.length ? (
                reports.map((report) => (
                  <article className="history-row victim-history-row" key={report.id}>
                    <div className="history-topline">
                      <span className="history-id">{report.id}</span>
                      <span className="status-badge status-badge--submitted">{formatStatus(report.status)}</span>
                    </div>
                    <div className="history-body">
                      <div className="history-main">
                        <h4>{report.summary}</h4>
                        <p>{report.location.locality} · {report.location.taluk}</p>
                      </div>
                      <div className="history-meta">
                        <span><Clock3 size={12} aria-hidden="true" /> {formatTimestamp(report.createdAt)}</span>
                        <span><Radio size={12} aria-hidden="true" /> {formatReportType(report.reportType)}</span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">No reports submitted yet.</div>
              )}
            </div>
          </section>
        ) : (
          <div className="victim-layout">
            <section className="sanket-panel victim-form-panel">
              <div className="sanket-panel-header">
                <div>
                  <p className="eyebrow">{citizenView === 'assistance' ? 'REQUEST ASSISTANCE' : 'REPORT INCIDENT'}</p>
                  <h3>{citizenView === 'assistance' ? 'Need help now?' : 'Share the issue'}</h3>
                </div>
              </div>

              <form className="sanket-form" onSubmit={handleSubmit}>
                <div className="sanket-field-group">
                  <Label className="field-label">Type</Label>
                  <div className="segmented-grid compact">
                    {incidentTypes
                      .filter((item) => (citizenView === 'assistance' ? item.value !== 'incident' : item.value !== 'assistance'))
                      .map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`segmented-option${draft.reportType === item.value ? ' active' : ''}`}
                          onClick={() => updateDraft('reportType', item.value)}
                        >
                          <span>{item.label}</span>
                          <small>{item.description}</small>
                        </button>
                      ))}
                  </div>
                </div>

                <div className="sanket-field-group">
                  <Label className="field-label">Category</Label>
                  <div className="chip-grid">
                    {categories.map((category) => (
                      <button
                        key={category.value}
                        type="button"
                        className={`chip${draft.category === category.value ? ' active' : ''}`}
                        onClick={() => updateDraft('category', category.value)}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sanket-field-group two-up">
                  <div>
                    <Label className="field-label">Urgency</Label>
                    <Select value={draft.urgency} onValueChange={(value) => updateDraft('urgency', value as SanketUrgency)}>
                      <SelectTrigger className="sanket-select"><SelectValue placeholder="Select urgency" /></SelectTrigger>
                      <SelectContent>
                        {urgencyLevels.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="field-label">Contact method</Label>
                    <Select value={draft.reporter.contactPreference} onValueChange={(value) => updateReporter('contactPreference', value as SanketReportDraft['reporter']['contactPreference'])}>
                      <SelectTrigger className="sanket-select"><SelectValue placeholder="Select contact" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="voice">Voice call</SelectItem>
                        <SelectItem value="none">No contact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="sanket-field-group two-up">
                  <div>
                    <Label className="field-label" htmlFor="reporter-name">Your name</Label>
                    <Input id="reporter-name" value={draft.reporter.name} onChange={(event) => updateReporter('name', event.target.value)} />
                  </div>
                  <div>
                    <Label className="field-label" htmlFor="reporter-phone">Phone number</Label>
                    <Input id="reporter-phone" value={draft.reporter.phone} onChange={(event) => updateReporter('phone', event.target.value)} />
                  </div>
                </div>

                <div className="sanket-field-group">
                  <Label className="field-label">Location</Label>
                  <div className="two-up">
                    <div>
                      <Label className="field-label" htmlFor="location-locality">Locality</Label>
                      <Input id="location-locality" value={draft.location.locality} onChange={(event) => updateLocation('locality', event.target.value)} placeholder="Nearby area or landmark" />
                    </div>
                    <div>
                      <Label className="field-label" htmlFor="location-taluk">Taluk</Label>
                      <Input id="location-taluk" value={draft.location.taluk} onChange={(event) => updateLocation('taluk', event.target.value)} placeholder="Taluk" />
                    </div>
                  </div>
                </div>

                <div className="sanket-field-group">
                  <Label className="field-label">Assistance needed</Label>
                  <div className="chip-grid narrow">
                    {assistanceOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={`chip${draft.assistanceNeeds.includes(option.value) ? ' active' : ''}`}
                        onClick={() => toggleAssistance(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sanket-field-group">
                  <Label className="field-label" htmlFor="summary">Short summary</Label>
                  <Input id="summary" value={draft.summary} onChange={(event) => updateDraft('summary', event.target.value)} placeholder="Brief description" />
                </div>

                <div className="sanket-field-group">
                  <Label className="field-label" htmlFor="details">Details</Label>
                  <textarea id="details" rows={5} value={draft.details} onChange={(event) => updateDraft('details', event.target.value)} placeholder="Please tell us what is happening and what help is needed." />
                </div>

                {validationError && <p className="form-error">{validationError}</p>}

                {submittedReportId && (
                  <div className="confirmation-card compact">
                    <CheckCircle2 size={24} aria-hidden="true" />
                    <div>
                      <p className="confirmation-label">Report received</p>
                      <h4>{submittedReportId}</h4>
                      <p>Status: {formatStatus('incoming')}</p>
                    </div>
                  </div>
                )}

                <div className="sanket-actions">
                  <Button type="submit" className="button button-primary">Submit report</Button>
                </div>
              </form>
            </section>

            <aside className="sanket-panel victim-summary-panel">
              <div className="sanket-panel-header">
                <div>
                  <p className="eyebrow">STATUS</p>
                  <h3>Current update</h3>
                </div>
              </div>

              <div className="mini-panel">
                <div className="mini-panel-header">
                  <FileText size={15} aria-hidden="true" />
                  <span>Latest report</span>
                </div>
                <p>{submittedReportId ? `${submittedReportId} is in the queue.` : 'No report submitted yet.'}</p>
                <p>{draft.summary || 'Add a short summary to begin your report.'}</p>
              </div>

              <div className="mini-panel">
                <div className="mini-panel-header">
                  <MapPin size={15} aria-hidden="true" />
                  <span>Location</span>
                </div>
                <p>{draft.location.locality || 'Locality not entered'}</p>
                <p>{draft.location.taluk || 'Taluk not entered'} · {draft.location.district || 'Udupi'}</p>
              </div>

              <div className="mini-panel">
                <div className="mini-panel-header">
                  <ShieldAlert size={15} aria-hidden="true" />
                  <span>Prototype note</span>
                </div>
                <ul>
                  <li>Reports stay in the current browser session.</li>
                  <li>No live dispatch is performed.</li>
                </ul>
              </div>

              <div className="mini-panel">
                <div className="mini-panel-header">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>Recent activity</span>
                </div>
                <ul>
                  {previewQueue.map((item) => (
                    <li key={item.id}>
                      <strong>{item.id}</strong> · {formatStatus(item.status)}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function formatStatus(status: SanketStatus) {
  const labels: Record<SanketStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    incoming: 'Received',
    under_review: 'Under review',
    assigned: 'Assistance assigned',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
  }

  return labels[status] ?? status.replace(/_/g, ' ')
}

function formatReportType(type: SanketReportType) {
  const labels: Record<SanketReportType, string> = {
    sos: 'SOS',
    incident: 'Incident',
    assistance: 'Assistance',
  }

  return labels[type] ?? type
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default SanketPage
