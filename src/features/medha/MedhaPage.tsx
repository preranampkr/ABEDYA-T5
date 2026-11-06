import { AlertTriangle, ArrowDownToLine, BrainCircuit, Check, Clock3, Filter, MapPin, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '../../components/ui/button'
import { medhaRepository } from './data/repository'
import type { MedhaDuplicateRecord, MedhaIncident } from './data/repository'
import { assessPriority, detectDuplicateCandidates, formatPriority } from './data/intelligence'
import type { DuplicateCandidate, MedhaDuplicateDecision, MedhaPriority, PriorityAssessment } from './data/intelligence'
import IncidentMap from './IncidentMap'
import './medha.css'

interface BoundaryProperties extends Record<string, unknown> {
  shapeID: string
}

interface DistrictBoundary {
  type: 'Feature'
  properties: BoundaryProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

type BoundaryCollection = { type: 'FeatureCollection'; features: DistrictBoundary[] }
type VerificationFilter = 'all' | 'unverified' | 'verified' | 'disputed'

async function fetchUdupiBoundary(signal: AbortSignal): Promise<DistrictBoundary> {
  const response = await fetch('/data/drishti/udupi-district.geojson', { signal })
  if (!response.ok) throw new Error(`Boundary request returned HTTP ${response.status}`)
  const collection = await response.json() as BoundaryCollection
  const feature = collection.features.find((item) => item.properties.shapeID === '76128533B4839184447445')
  if (!feature) throw new Error('Verified Udupi district outline was not found.')
  return feature
}

const incidentTypeLabels: Record<MedhaIncident['reportType'], string> = {
  sos: 'SOS',
  incident: 'Incident',
  assistance: 'Assistance request',
}

const statusLabels: Record<MedhaIncident['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  incoming: 'Incoming',
  under_review: 'Under review',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

function pairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(':')
}

function countLabel(value: number | null) {
  return value === null ? 'Unknown' : value.toLocaleString()
}

function timeLabel(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
    : 'Timestamp unavailable'
}

function ReviewActivity({ incident }: { incident: MedhaIncident }) {
  const statusHistory = [...incident.assignmentHistory]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const medhaHistory = [...incident.reviewHistory]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  if (!statusHistory.length && !medhaHistory.length) {
    return <p className="medha-muted">No review or status history is available.</p>
  }

  return (
    <ol className="medha-history-list">
      {medhaHistory.map((event) => (
        <li key={event.id}>
          <strong>{event.action.replace(/_/g, ' ')}</strong>
          <span>{event.note}</span>
          <small>{timeLabel(event.at)} · {event.by}</small>
        </li>
      ))}
      {statusHistory.map((event, index) => (
        <li key={`${event.at}-${event.to}-${index}`}>
          <strong>SANKET status: {statusLabels[event.to]}</strong>
          {event.note && <span>{event.note}</span>}
          <small>{timeLabel(event.at)} · {event.by}</small>
        </li>
      ))}
    </ol>
  )
}

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function Metric({ label, value, detail, tone = 'default' }: {
  label: string
  value: number
  detail: string
  tone?: 'default' | 'critical' | 'warning'
}) {
  return (
    <article className={`medha-metric medha-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  )
}

function Distribution({ title, rows, labels }: {
  title: string
  rows: Array<[string, number]>
  labels: Record<string, string>
}) {
  const maximum = Math.max(1, ...rows.map(([, count]) => count))
  return (
    <section className="medha-analysis-panel">
      <h3>{title}</h3>
      {rows.length ? rows.map(([key, count]) => (
        <div className="medha-distribution-row" key={key}>
          <span>{labels[key] ?? key.replace(/_/g, ' ')}</span>
          <span className="medha-distribution-track" aria-hidden="true">
            <i style={{ width: `${Math.max(4, count / maximum * 100)}%` }} />
          </span>
          <strong>{count}</strong>
        </div>
      )) : <p className="medha-muted">No report data available.</p>}
    </section>
  )
}

function activityFor(incidents: MedhaIncident[]) {
  return incidents.flatMap((incident) => [
    { id: `${incident.id}-submitted`, reportId: incident.id, label: 'SANKET report received', at: incident.createdAt },
    ...incident.reviewHistory.map((event) => ({
      id: event.id,
      reportId: incident.id,
      label: event.action.replace(/_/g, ' '),
      at: event.at,
    })),
  ]).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 7)
}

function priorityFor(incident: MedhaIncident, assessments: Map<string, PriorityAssessment>) {
  return incident.priorityOverride?.priority ?? assessments.get(incident.id)?.priority ?? 'medium'
}

function duplicateIndex(incidents: MedhaIncident[]) {
  const index = new Map<string, MedhaDuplicateRecord>()
  for (const incident of incidents) {
    for (const match of incident.duplicateMatches) {
      index.set(pairKey(match.firstReportId, match.secondReportId), match)
    }
  }
  return index
}

function MedhaPage() {
  const [incidents, setIncidents] = useState<MedhaIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [todayUtcStart] = useState(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    return today.getTime()
  })
  const [error, setError] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overridePriority, setOverridePriority] = useState<{ reportId: string; priority: MedhaPriority } | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | MedhaIncident['reportType']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | MedhaPriority>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | MedhaIncident['status']>('all')
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all')
  const [boundary, setBoundary] = useState<DistrictBoundary | null>(null)
  const [boundaryError, setBoundaryError] = useState('')

  const assessments = useMemo(() => new Map(
    incidents.map((incident) => [incident.id, incident.storedAssessment ?? assessPriority(incident)]),
  ), [incidents])
  const operationalIncidents = useMemo(
    () => incidents.filter((incident) => incident.originKind === 'user_submission'),
    [incidents],
  )
  const duplicateSuggestions = useMemo(() => detectDuplicateCandidates(operationalIncidents), [operationalIncidents])
  const storedDuplicates = useMemo(() => duplicateIndex(incidents), [incidents])
  const duplicateCandidates = useMemo(() => {
    const candidates = new Map<string, DuplicateCandidate & { decision?: MedhaDuplicateDecision }>()
    for (const candidate of duplicateSuggestions) {
      candidates.set(pairKey(candidate.firstReportId, candidate.secondReportId), {
        ...candidate,
        decision: storedDuplicates.get(pairKey(candidate.firstReportId, candidate.secondReportId))?.decision,
      })
    }
    for (const [key, match] of storedDuplicates) {
      const current = candidates.get(key)
      candidates.set(key, current ? { ...current, decision: match.decision } : match)
    }
    return [...candidates.values()].sort((a, b) => b.similarity - a.similarity)
  }, [duplicateSuggestions, storedDuplicates])

  const priorities = useMemo(() => new Map(
    incidents.map((incident) => [incident.id, priorityFor(incident, assessments)]),
  ), [assessments, incidents])

  const filteredIncidents = useMemo(() => {
    const locationQuery = locationFilter.trim().toLowerCase()
    return incidents.filter((incident) => {
      const locationMatches = !locationQuery || [
        incident.location.label,
        incident.location.locality,
        incident.location.taluk,
        incident.location.district,
      ].some((value) => value.toLowerCase().includes(locationQuery))
      return locationMatches &&
        (typeFilter === 'all' || incident.reportType === typeFilter) &&
        (priorityFilter === 'all' || priorities.get(incident.id) === priorityFilter) &&
        (statusFilter === 'all' || incident.status === statusFilter) &&
        (verificationFilter === 'all' || incident.verificationStatus === verificationFilter)
    })
  }, [incidents, locationFilter, priorities, priorityFilter, statusFilter, typeFilter, verificationFilter])

  const selectedIncident = incidents.find((incident) => incident.id === selectedReportId) ?? null
  const selectedAssessment = selectedIncident ? assessments.get(selectedIncident.id) : undefined
  const selectedPriority = selectedIncident ? priorityFor(selectedIncident, assessments) : null
  const overridePriorityValue = selectedIncident && overridePriority?.reportId === selectedIncident.id
    ? overridePriority.priority
    : selectedPriority ?? 'medium'
  const selectedPairs = selectedIncident
    ? duplicateCandidates.filter((candidate) =>
        candidate.firstReportId === selectedIncident.id || candidate.secondReportId === selectedIncident.id,
      )
    : []
  const reportById = useMemo(() => new Map(incidents.map((incident) => [incident.id, incident])), [incidents])
  const typeDistribution = countBy(operationalIncidents.map((incident) => incident.reportType))
  const statusDistribution = countBy(operationalIncidents.map((incident) => incident.status))
  const locationDistribution = countBy(operationalIncidents
    .map((incident) => incident.location.locality.trim())
    .filter((locality) => locality.length > 0))
    .slice(0, 6)
  const frequencyByDay = new Map<string, number>()
  const unverifiedByDay = new Map<string, number>()
  const unresolvedByDay = new Map<string, number>()
  for (const incident of operationalIncidents) {
    const timestamp = Date.parse(incident.createdAt)
    if (!Number.isFinite(timestamp)) continue
    const day = new Date(timestamp).toISOString().slice(0, 10)
    frequencyByDay.set(day, (frequencyByDay.get(day) ?? 0) + 1)
    if (incident.verificationStatus === 'unverified') {
      unverifiedByDay.set(day, (unverifiedByDay.get(day) ?? 0) + 1)
    }
    if (!['resolved', 'closed'].includes(incident.status)) {
      unresolvedByDay.set(day, (unresolvedByDay.get(day) ?? 0) + 1)
    }
  }
  const reportingFrequency = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayUtcStart)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return [key, frequencyByDay.get(key) ?? 0] as [string, number]
  })
  const frequencyLabels = Object.fromEntries(reportingFrequency.map(([date]) => [
    date,
    new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
  ]))
  const unverifiedTrend = reportingFrequency.map(([date]) => [date, unverifiedByDay.get(date) ?? 0] as [string, number])
  const unresolvedTrend = reportingFrequency.map(([date]) => [date, unresolvedByDay.get(date) ?? 0] as [string, number])
  const unresolvedCount = operationalIncidents.filter((incident) => !['resolved', 'closed'].includes(incident.status)).length
  const potentialDuplicateReportIds = new Set(duplicateCandidates
    .filter((candidate) => candidate.decision !== 'rejected')
    .flatMap((candidate) => [candidate.firstReportId, candidate.secondReportId]))
  const recentActivity = activityFor(operationalIncidents)
  const currentPriority = (incident: MedhaIncident) => priorities.get(incident.id) ?? 'medium'
  const unverifiedCount = operationalIncidents.filter((incident) => incident.verificationStatus === 'unverified').length
  const highPriorityCount = operationalIncidents.filter((incident) => ['critical', 'high'].includes(currentPriority(incident))).length
  const demonstrationCount = incidents.filter((incident) => incident.originKind === 'demo').length
  const operationalCount = incidents.length - demonstrationCount
  const reportsWithoutCoordinates = filteredIncidents.filter((incident) =>
    incident.location.latitude === undefined || incident.location.longitude === undefined,
  ).length

  const refresh = useCallback(async (active?: () => boolean) => {
    try {
      const nextIncidents = await medhaRepository.listIncidents()
      if (active && !active()) return
      setError('')
      setAnalysisError('')
      setIncidents(nextIncidents)
      setSelectedReportId((current) =>
        current && nextIncidents.some((incident) => incident.id === current)
          ? current
          : nextIncidents[0]?.id ?? null,
      )
      if (nextIncidents.length) {
        try {
          await medhaRepository.saveAnalyses(nextIncidents.map((incident) => ({ reportId: incident.id })))
        } catch (saveError) {
          if (!active || active()) {
            setAnalysisError(saveError instanceof Error
              ? `Suggestions are available, but analysis snapshots could not be saved: ${saveError.message}`
              : 'Suggestions are available, but analysis snapshots could not be saved.')
          }
        }
      }
    } catch (loadError) {
      if (!active || active()) {
        setError(loadError instanceof Error ? loadError.message : 'MEDHA incidents could not be loaded.')
      }
    } finally {
      if (!active || active()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadInitialIncidents() {
      try {
        const nextIncidents = await medhaRepository.listIncidents()
        if (!active) return
        setError('')
        setAnalysisError('')
        setIncidents(nextIncidents)
        setSelectedReportId((current) =>
          current && nextIncidents.some((incident) => incident.id === current)
            ? current
            : nextIncidents[0]?.id ?? null,
        )
        if (nextIncidents.length) {
          try {
            await medhaRepository.saveAnalyses(nextIncidents.map((incident) => ({ reportId: incident.id })))
          } catch (saveError) {
            if (active) {
              setAnalysisError(saveError instanceof Error
                ? `Suggestions are available, but analysis snapshots could not be saved: ${saveError.message}`
                : 'Suggestions are available, but analysis snapshots could not be saved.')
            }
          }
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'MEDHA incidents could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadInitialIncidents()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchUdupiBoundary(controller.signal).then(
      (feature) => { if (!controller.signal.aborted) setBoundary(feature) },
      (loadError: unknown) => {
        if (controller.signal.aborted) return
        setBoundaryError(loadError instanceof Error ? loadError.message : 'District boundary could not be loaded.')
      },
    )
    return () => controller.abort()
  }, [])

  async function submitReview(action: 'verified' | 'request_information') {
    if (!selectedIncident) return
    setBusy(true)
    setReviewError('')
    try {
      await medhaRepository.reviewIncident(selectedIncident.id, action, reviewNote)
      setReviewNote('')
      await refresh()
    } catch (actionError) {
      setReviewError(actionError instanceof Error ? actionError.message : 'Review decision could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  async function submitDuplicateDecision(candidate: DuplicateCandidate, decision: MedhaDuplicateDecision) {
    setBusy(true)
    setReviewError('')
    try {
      await medhaRepository.decideDuplicate(candidate, decision, reviewNote)
      setReviewNote('')
      await refresh()
    } catch (actionError) {
      setReviewError(actionError instanceof Error ? actionError.message : 'Duplicate decision could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  async function submitPriorityOverride() {
    if (!selectedIncident || !selectedAssessment) return
    setBusy(true)
    setReviewError('')
    try {
      await medhaRepository.overridePriority(selectedIncident.id, overridePriorityValue, overrideReason)
      setOverrideReason('')
      await refresh()
    } catch (actionError) {
      setReviewError(actionError instanceof Error ? actionError.message : 'Priority override could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  async function exportSenaHandoff() {
    setBusy(true)
    setReviewError('')
    try {
      const handoff = await medhaRepository.getSenaHandoff()
      if (!handoff.length) {
        setReviewError('No verified incidents are currently available for the SENA handoff.')
        return
      }
      const blob = new Blob([JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: 'ABHEDYA MEDHA',
        note: 'Verified incident data only. This export does not dispatch responders.',
        incidents: handoff,
      }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `abhedya-medha-sena-handoff-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setReviewError(exportError instanceof Error ? exportError.message : 'SENA handoff could not be prepared.')
    } finally {
      setBusy(false)
    }
  }

  const mapPriorities = useMemo(() => new Map(filteredIncidents.map((incident) => [
    incident.id,
    priorities.get(incident.id) ?? 'medium',
  ])), [filteredIncidents, priorities])

  return (
    <DashboardLayout
      role="helper"
      title="MEDHA"
      description="Incident intelligence for SANKET report review and verified response handoff."
      eyebrow="HELPER MODULE / MEDHA"
      wide
    >
      <main className="medha-workspace">
        <header className="medha-topbar">
          <div>
            <p className="eyebrow">INCIDENT INTELLIGENCE / Udupi District</p>
            <h2>Reported incidents</h2>
            <p>Source records remain in SANKET. MEDHA provides review, explainable prioritisation and duplicate flags.</p>
          </div>
          <div className="medha-topbar-actions">
            {demonstrationCount > 0 && <span className="medha-data-badge">INCLUDES {demonstrationCount} DEMO REPORTS</span>}
            <Button className="button button-outline button-small" variant="outline" size="sm" onClick={() => { setLoading(true); void refresh() }} disabled={loading}>
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </Button>
            <Button className="button button-primary button-small" size="sm" onClick={() => void exportSenaHandoff()} disabled={busy}>
              <ArrowDownToLine size={14} aria-hidden="true" /> SENA handoff
            </Button>
          </div>
        </header>

        {error && <p className="medha-message medha-message-error" role="alert">{error}</p>}
        {analysisError && <p className="medha-message medha-message-warning" role="status">{analysisError}</p>}
        {reviewError && <p className="medha-message medha-message-error" role="alert">{reviewError}</p>}
        {loading && <p className="medha-message" role="status">Loading SANKET incident records…</p>}

        {!error && (
          <>
            <section className="medha-metrics" aria-label="Incident overview">
              <Metric label="Operational reports" value={operationalCount} detail={demonstrationCount ? `${demonstrationCount} demonstration examples excluded` : 'SANKET source records'} />
              <Metric label="Awaiting verification" value={unverifiedCount} detail="Explicitly unverified reports" tone="warning" />
              <Metric label="High priority" value={highPriorityCount} detail="Critical or high suggested / overridden" tone="critical" />
              <Metric label="Potential duplicate reports" value={potentialDuplicateReportIds.size} detail={`${duplicateCandidates.filter((candidate) => candidate.decision !== 'rejected').length} report pairs · human review required`} />
            </section>

            <section className="medha-map-section" aria-label="Geographic incident intelligence">
              <div className="medha-map-heading">
                <div>
                  <p className="eyebrow">GEOGRAPHIC INTELLIGENCE</p>
                  <h2>Incident locations</h2>
                  <span>{filteredIncidents.length} matching reports · {reportsWithoutCoordinates} without coordinates</span>
                </div>
                <span className="medha-boundary-note">{boundary ? 'Udupi district reference boundary · DRISHTI dataset' : 'Loading DRISHTI district reference boundary'}</span>
              </div>

              <div className="medha-filters" aria-label="Incident filters">
                <label><MapPin size={14} aria-hidden="true" /><input value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder="Filter locality, taluk or district" /></label>
                <label><Filter size={14} aria-hidden="true" /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
                  <option value="all">All report types</option>
                  <option value="sos">SOS</option>
                  <option value="incident">Incident</option>
                  <option value="assistance">Assistance</option>
                </select></label>
                <label><AlertTriangle size={14} aria-hidden="true" /><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
                  <option value="all">All priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select></label>
                <label><Clock3 size={14} aria-hidden="true" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select></label>
                <label><ShieldCheck size={14} aria-hidden="true" /><select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as VerificationFilter)}>
                  <option value="all">All verification</option>
                  <option value="unverified">Unverified</option>
                  <option value="verified">Verified</option>
                  <option value="disputed">Disputed</option>
                </select></label>
              </div>

              <div className="medha-map-legend" aria-label="Map legend">
                <span><i className="medha-legend-dot medha-marker-critical" />Critical</span>
                <span><i className="medha-legend-dot medha-marker-high" />High</span>
                <span><i className="medha-legend-dot medha-marker-medium" />Medium</span>
                <span><i className="medha-legend-dot medha-marker-low" />Low</span>
                <span><i className="medha-legend-cluster">3</i>Nearby reports grouped · 1.5 km</span>
                <span>Type is shown in marker shape and detail</span>
              </div>
              <div className="medha-map-canvas">
                <IncidentMap
                  incidents={filteredIncidents}
                  priorities={mapPriorities}
                  boundary={boundary}
                  boundaryError={boundaryError}
                  selectedReportId={selectedReportId}
                  onSelect={setSelectedReportId}
                />
              </div>
            </section>

            <section className="medha-analysis-grid" aria-label="Incident analysis">
              <Distribution title="Reports by type" rows={typeDistribution} labels={incidentTypeLabels} />
              <Distribution title="Workflow status" rows={statusDistribution} labels={statusLabels} />
              <Distribution title="Reported localities" rows={locationDistribution} labels={{}} />
              <Distribution title="Reports received · last 7 days" rows={reportingFrequency} labels={frequencyLabels} />
              <Distribution title="Unverified reports by submission date · current state" rows={unverifiedTrend} labels={frequencyLabels} />
              <Distribution title="Unresolved reports by submission date · current state" rows={unresolvedTrend} labels={frequencyLabels} />
              <section className="medha-analysis-panel">
                <h3>Unresolved trend</h3>
                <p className="medha-analysis-number">{unresolvedCount}<span> of {incidents.length} reports not resolved or closed</span></p>
                <p className="medha-muted">Counts follow current SANKET status values; MEDHA does not change response status.</p>
              </section>
              <section className="medha-analysis-panel medha-recent-panel">
                <h3>Recent report and review activity</h3>
                {recentActivity.length ? (
                  <ol className="medha-activity-list">
                    {recentActivity.map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => setSelectedReportId(item.reportId)}>{item.reportId}</button>
                        <span>{item.label}</span>
                        <time>{timeLabel(item.at)}</time>
                      </li>
                    ))}
                  </ol>
                ) : <p className="medha-muted">No recent activity is available.</p>}
              </section>
            </section>

            <section className="medha-review-layout" aria-label="Incident review">
              <section className="medha-review-panel">
                <div className="medha-panel-heading">
                  <div><p className="eyebrow">INCIDENT REVIEW</p><h2>{selectedIncident?.id ?? 'Select a report'}</h2></div>
                  {selectedIncident && <span className={`medha-priority-pill medha-priority-${selectedPriority}`}>{selectedPriority && formatPriority(selectedPriority)}</span>}
                </div>
                {selectedIncident && selectedAssessment ? (
                  <>
                    <div className="medha-incident-meta">
                      <span>{incidentTypeLabels[selectedIncident.reportType]} · {selectedIncident.category.replace(/_/g, ' ')}</span>
                      <span className={`medha-status-tag medha-status-${selectedIncident.status}`}>{statusLabels[selectedIncident.status]}</span>
                      <span className={`medha-verification medha-verification-${selectedIncident.verificationStatus}`}>{selectedIncident.verificationStatus}</span>
                    </div>
                    {selectedIncident.originKind === 'demo' && (
                      <p className="medha-message medha-message-warning" role="note">Demonstration example · not an operational SANKET report. Review and handoff are disabled.</p>
                    )}
                    <h3 className="medha-incident-summary">{selectedIncident.summary}</h3>
                    <p className="medha-incident-description">{selectedIncident.details}</p>
                    <dl className="medha-fact-grid">
                      <div><dt>Location</dt><dd>{[selectedIncident.location.locality, selectedIncident.location.taluk, selectedIncident.location.district].filter(Boolean).join(' · ') || 'Not reported'}</dd></div>
                      <div><dt>Coordinates</dt><dd>{selectedIncident.location.latitude !== undefined && selectedIncident.location.longitude !== undefined ? `${selectedIncident.location.latitude.toFixed(5)}, ${selectedIncident.location.longitude.toFixed(5)}` : 'Unknown · no marker plotted'}</dd></div>
                      <div><dt>People affected</dt><dd>{countLabel(selectedIncident.reportedImpacts.peopleAffected)}</dd></div>
                      <div><dt>Reported injuries</dt><dd>{countLabel(selectedIncident.reportedImpacts.reportedInjuries)}</dd></div>
                      <div><dt>Vulnerable people</dt><dd>{countLabel(selectedIncident.reportedImpacts.vulnerablePeople)}</dd></div>
                      <div><dt>People trapped</dt><dd>{countLabel(selectedIncident.reportedImpacts.peopleTrapped)}</dd></div>
                      <div><dt>Assistance needs</dt><dd>{selectedIncident.assistanceNeeds.length ? selectedIncident.assistanceNeeds.map((need) => need.replace(/_/g, ' ')).join(', ') : 'None specified'}</dd></div>
                      <div><dt>Reported</dt><dd>{timeLabel(selectedIncident.createdAt)}</dd></div>
                    </dl>
                    <p className="medha-evidence-note">Evidence attachments are not available in the current SANKET report schema.</p>

                    <section className="medha-priority-explanation">
                      <div className="medha-subheading"><BrainCircuit size={16} aria-hidden="true" /><h3>Explainable priority suggestion</h3><span>{selectedAssessment.confidence}% support</span></div>
                      <p>Deterministic rule set · {selectedAssessment.algorithmVersion} · Suggested score {selectedAssessment.score}. This is decision support, not a dispatch or safety decision.</p>
                      <ul className="medha-factor-list">
                        {selectedAssessment.factors.map((factor) => (
                          <li key={factor.key}>
                            <span>{factor.label}</span><strong>{factor.points > 0 ? `+${factor.points}` : 'Review'}</strong>
                            <small>{factor.explanation}</small>
                          </li>
                        ))}
                      </ul>
                      {selectedAssessment.unknownFactors.length > 0 && (
                        <p className="medha-unknown-note"><AlertTriangle size={14} aria-hidden="true" /> Unknown, not assumed zero: {selectedAssessment.unknownFactors.join(', ')}.</p>
                      )}
                      {selectedIncident.priorityOverride && (
                        <p className="medha-override-note">Reviewer override: {formatPriority(selectedIncident.priorityOverride.priority)} · {selectedIncident.priorityOverride.reason} · {selectedIncident.priorityOverride.by}, {timeLabel(selectedIncident.priorityOverride.at)}</p>
                      )}
                    </section>

                    <section className="medha-review-actions">
                      <h3>Human review decisions</h3>
                      <label className="medha-note-label">Decision note <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={2} placeholder="Required for verification, information requests and duplicate decisions." /></label>
                      <div className="medha-action-row">
                        {selectedIncident.verificationStatus !== 'verified' && (
                          <Button type="button" size="sm" className="button button-primary" disabled={busy || selectedIncident.originKind === 'demo'} onClick={() => void submitReview('verified')}>
                            <Check size={14} aria-hidden="true" /> Verify report
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="outline" className="button button-outline" disabled={busy || selectedIncident.originKind === 'demo'} onClick={() => void submitReview('request_information')}>
                          Request more information
                        </Button>
                      </div>
                      <div className="medha-override-form">
                        <label>Override suggested priority
                          <select disabled={selectedIncident.originKind === 'demo'} value={overridePriorityValue} onChange={(event) => setOverridePriority({
                            reportId: selectedIncident.id,
                            priority: event.target.value as MedhaPriority,
                          })}>
                            <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                          </select>
                        </label>
                        <label>Reason for override
                          <textarea disabled={selectedIncident.originKind === 'demo'} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={2} minLength={10} placeholder="Explain the evidence or context behind the override." />
                        </label>
                        <Button type="button" size="sm" variant="outline" className="button button-outline" disabled={busy || selectedIncident.originKind === 'demo' || overridePriorityValue === selectedPriority} onClick={() => void submitPriorityOverride()}>
                          Record priority override
                        </Button>
                      </div>
                    </section>
                  </>
                ) : <p className="medha-muted">Select an incident from the map, activity list or duplicate comparison.</p>}
              </section>

              <aside className="medha-review-aside">
                <section className="medha-analysis-panel">
                  <h3>Potential duplicate comparisons</h3>
                  <p className="medha-muted">Suggestions use reported text, type, time and available location. Confirming a match never merges or removes either source report.</p>
                  {selectedPairs.length ? (
                    <div className="medha-duplicate-list">
                      {selectedPairs.map((candidate) => {
                        const otherId = candidate.firstReportId === selectedIncident?.id ? candidate.secondReportId : candidate.firstReportId
                        const other = reportById.get(otherId)
                        const stored = storedDuplicates.get(pairKey(candidate.firstReportId, candidate.secondReportId))
                        const decision = stored?.decision ?? candidate.decision ?? 'flagged'
                        return (
                          <article className="medha-duplicate-card" key={pairKey(candidate.firstReportId, candidate.secondReportId)}>
                            <div><strong>{candidate.firstReportId}</strong><span>↔</span><button type="button" onClick={() => setSelectedReportId(otherId)}>{candidate.secondReportId}</button></div>
                            <p>{other?.summary ?? 'Source report unavailable'}</p>
                            <strong className="medha-similarity">{candidate.similarity}% possible similarity · {decision.replace(/_/g, ' ')}</strong>
                            <ul>{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                            {decision === 'flagged' ? (
                              <div className="medha-action-row">
                                <Button type="button" size="sm" className="button button-primary" disabled={busy || selectedIncident?.originKind === 'demo' || other?.originKind === 'demo'} onClick={() => void submitDuplicateDecision(candidate, 'confirmed')}>Confirm match</Button>
                                <Button type="button" size="sm" variant="outline" className="button button-outline" disabled={busy || selectedIncident?.originKind === 'demo' || other?.originKind === 'demo'} onClick={() => void submitDuplicateDecision(candidate, 'rejected')}>Reject match</Button>
                                {!stored && <Button type="button" size="sm" variant="outline" className="button button-outline" disabled={busy || selectedIncident?.originKind === 'demo' || other?.originKind === 'demo'} onClick={() => void submitDuplicateDecision(candidate, 'flagged')}>Flag for review</Button>}
                              </div>
                            ) : <p className="medha-muted">Human decision recorded; both report records remain unchanged.</p>}
                          </article>
                        )
                      })}
                    </div>
                  ) : <p className="medha-muted">No possible duplicates are currently suggested for this report.</p>}
                </section>

                <section className="medha-analysis-panel">
                  <h3>Review and SANKET history</h3>
                  {selectedIncident ? <ReviewActivity incident={selectedIncident} /> : <p className="medha-muted">Select a report to view its history.</p>}
                </section>
                <section className="medha-analysis-panel medha-handoff-note">
                  <h3><UsersRound size={15} aria-hidden="true" /> SENA response handoff</h3>
                  <p>Only human-verified source incidents are included. Report IDs and SANKET status history are preserved. Export does not dispatch responders.</p>
                  <Button type="button" size="sm" variant="outline" className="button button-outline" disabled={busy} onClick={() => void exportSenaHandoff()}>
                    <ArrowDownToLine size={14} aria-hidden="true" /> Export verified incidents
                  </Button>
                </section>
              </aside>
            </section>
          </>
        )}
      </main>
    </DashboardLayout>
  )
}

export default MedhaPage
