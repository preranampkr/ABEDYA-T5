import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  BatteryCharging,
  CheckCircle2,
  Filter,
  LifeBuoy,
  MapPin,
  Phone,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Truck,
  Waves,
  Wifi,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import ResponseMap from './ResponseMap'
import { senaRepository } from './data/repository'
import { capabilityLabels, getUnitMatchScore } from './data/responseUnits'
import type { ResponseUnit, SenaDispatchStatus, SenaIncidentItem } from './types'
import type { MedhaPriority } from '../medha/data/intelligence'
import './sena.css'

async function fetchSenaData() {
  const [incidentList, unitList] = await Promise.all([
    senaRepository.getIncidents(),
    senaRepository.getUnits(),
  ])
  return { incidentList, unitList }
}

export default function SenaPage() {
  const [incidents, setIncidents] = useState<SenaIncidentItem[]>([])
  const [units, setUnits] = useState<ResponseUnit[]>([])
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [boundary, setBoundary] = useState<any | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<'all' | MedhaPriority>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SenaDispatchStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dispatch Form State
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [missionBrief, setMissionBrief] = useState('')
  const [isDispatching, setIsDispatching] = useState(false)

  // Field log input
  const [fieldLogText, setFieldLogText] = useState('')
  const [isAddingLog, setIsAddingLog] = useState(false)

  // Resolution modal inputs
  const [rescuedCountInput, setRescuedCountInput] = useState<number>(0)
  const [resolutionNote, setResolutionNote] = useState('')

  // Load geojson boundary
  useEffect(() => {
    fetch('/data/drishti/udupi-district.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load district boundary')
        return res.json()
      })
      .then((data) => setBoundary(data))
      .catch(() => {
        // Fallback gracefully without boundary
      })
  }, [])

  const applyData = useCallback(({ incidentList, unitList }: { incidentList: SenaIncidentItem[]; unitList: ResponseUnit[] }) => {
    setErrorMessage(null)
    setIncidents(incidentList)
    setUnits(unitList)
    setSelectedIncidentId((current) =>
      current && incidentList.some((item) => item.id === current)
        ? current
        : incidentList[0]?.id ?? null,
    )
  }, [])

  const loadData = useCallback(() => {
    return fetchSenaData()
      .then(applyData)
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load SENA response data')
      })
      .finally(() => {
        setIsRefreshing(false)
      })
  }, [applyData])

  useEffect(() => {
    let active = true
    void fetchSenaData()
      .then((data) => {
        if (!active) return
        applyData(data)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load SENA response data')
      })
    return () => {
      active = false
    }
  }, [applyData])

  const handleRefresh = () => {
    setIsRefreshing(true)
    void loadData()
  }

  const selectedIncident = useMemo(() => {
    return incidents.find((i) => i.id === selectedIncidentId) ?? null
  }, [incidents, selectedIncidentId])

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (priorityFilter !== 'all' && incident.priority !== priorityFilter) return false
      const currentStatus: SenaDispatchStatus = incident.activeDispatch?.status ?? 'pending_dispatch'
      if (statusFilter !== 'all' && currentStatus !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = incident.summary.toLowerCase().includes(q)
        const matchLoc = incident.location.label.toLowerCase().includes(q)
        const matchTaluk = incident.location.taluk?.toLowerCase().includes(q)
        if (!matchTitle && !matchLoc && !matchTaluk) return false
      }
      return true
    })
  }, [incidents, priorityFilter, statusFilter, searchQuery])

  // Operational metrics
  const metrics = useMemo(() => {
    const total = incidents.length
    const criticalPending = incidents.filter(
      (i) => i.priority === 'critical' && (!i.activeDispatch || i.activeDispatch.status === 'pending_dispatch')
    ).length
    const deployedUnits = units.filter((u) => u.status === 'deployed').length
    const availableUnits = units.filter((u) => u.status === 'available').length
    return { total, criticalPending, deployedUnits, availableUnits }
  }, [incidents, units])

  // Ranked units for selected incident
  const rankedUnits = useMemo(() => {
    if (!selectedIncident) return []
    return units
      .map((unit) => {
        const { score, matchedCapabilities } = getUnitMatchScore(unit, selectedIncident.assistanceNeeds)
        return { unit, score, matchedCapabilities }
      })
      .sort((a, b) => b.score - a.score)
  }, [selectedIncident, units])

  // Handle Dispatch
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIncident || !selectedUnitId || !missionBrief.trim()) return
    setIsDispatching(true)
    setErrorMessage(null)
    setActionSuccess(null)

    try {
      const order = await senaRepository.dispatchUnit({
        incidentId: selectedIncident.id,
        unitId: selectedUnitId,
        priority: selectedIncident.priority,
        missionBrief: missionBrief.trim(),
        assignedBy: 'SENA Duty Officer',
      })

      setActionSuccess(`Unit dispatched successfully under order #${order.id}`)
      setMissionBrief('')
      setSelectedUnitId('')
      await loadData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Dispatch authorization failed')
    } finally {
      setIsDispatching(false)
    }
  }

  // Handle Stage Transition
  const handleUpdateStage = async (nextStatus: SenaDispatchStatus) => {
    if (!selectedIncident?.activeDispatch) return
    setErrorMessage(null)
    setActionSuccess(null)

    const statusNotes: Record<SenaDispatchStatus, string> = {
      pending_dispatch: 'Returned to standby queue',
      dispatched: 'Mission order confirmed; team mobilizing',
      en_route: 'Response team en route to incident coordinates',
      on_scene: 'Team arrived on scene; incident assessment and intervention initiated',
      operation_underway: 'Search, rescue and stabilization operations underway',
      resolved: resolutionNote.trim() || 'Incident resolved; evacuated victims handed over to medical/shelter',
    }

    try {
      await senaRepository.updateStage({
        incidentId: selectedIncident.id,
        status: nextStatus,
        updatedBy: 'SENA Duty Officer',
        note: statusNotes[nextStatus],
        outcome:
          nextStatus === 'resolved'
            ? {
                rescuedCount: rescuedCountInput,
                notes: resolutionNote.trim() || 'Operations completed successfully.',
              }
            : undefined,
      })

      setActionSuccess(`Operation stage updated to: ${nextStatus.replace('_', ' ').toUpperCase()}`)
      setResolutionNote('')
      setRescuedCountInput(0)
      await loadData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update operation stage')
    }
  }

  // Handle Add Field Log
  const handleAddFieldLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIncident?.activeDispatch || !fieldLogText.trim()) return
    setIsAddingLog(true)
    try {
      await senaRepository.addLog(selectedIncident.id, fieldLogText.trim(), 'Field Officer')
      setFieldLogText('')
      await loadData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to record field log')
    } finally {
      setIsAddingLog(false)
    }
  }

  // Export tactical summary
  const handleExportDeployment = () => {
    const summary = {
      generatedAt: new Date().toISOString(),
      commandAuthority: 'ABHEDYA SENA Tactical Command',
      activeIncidents: incidents.map((i) => ({
        id: i.id,
        priority: i.priority,
        category: i.category,
        location: i.location,
        needs: i.assistanceNeeds,
        dispatchStatus: i.activeDispatch?.status ?? 'pending_dispatch',
        assignedUnit: i.activeDispatch?.unitName ?? null,
      })),
      responseUnits: units.map((u) => ({
        id: u.id,
        callSign: u.callSign,
        status: u.status,
        assignedIncident: u.assignedIncidentId,
        personnel: u.personnelCount,
      })),
    }

    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abhedya-sena-deployment-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout
      role="helper"
      title="SENA"
      description="Incident review, response dispatch, and field operation coordination."
      eyebrow="HELPER WORKSPACE / SENA RESPONSE COMMAND"
    >
      <div className="sena-workspace">
        {/* Topbar */}
        <section className="sena-topbar">
          <div>
            <h2>SENA Tactical Response Command</h2>
            <p>
              Authoritative dispatch and operational coordination for verified SANKET incidents.
            </p>
          </div>
          <div className="sena-topbar-actions">
            <Button
              variant="outline"
              size="sm"
              className="button button-outline button-small"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
              Sync Feeds
            </Button>
            <Button
              size="sm"
              className="button button-primary button-small"
              onClick={handleExportDeployment}
            >
              <ArrowDownToLine size={14} aria-hidden="true" /> Export Deployment JSON
            </Button>
          </div>
        </section>

        {/* Emergency Operations Banner: Top Tactical Edge */}
        <div className="sena-ops-banner">
          <div className="sena-ops-banner-left">
            <span className="sena-ping-dot" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              RED-ALERT // SURGE PHASE-3
            </span>
            <span style={{ fontSize: '11px', opacity: 0.9 }}>• FLOODWATER PEAK IN T-45M</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, background: '#04110a', padding: '2px 8px', borderRadius: '4px', color: '#ffb4ab' }}>
            CRIT-4
          </span>
        </div>

        {/* Active Unit Telemetry Header */}
        <div className="sena-unit-telemetry-strip">
          <div className="sena-unit-telemetry-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(131, 185, 107, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                  UNIT-NDRF-01
                </span>
                <span style={{ fontSize: '10px', color: 'var(--sage)', fontFamily: 'var(--font-mono)' }}>
                  ALPHA TEAM • COMMAND BOAT 02 • DISPATCH CONTROL
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(131, 185, 107, 0.15)', color: 'var(--tactical)', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--tactical)' }} />
              <span>DEPLOYED ON SCENE</span>
            </div>
          </div>

          <div className="sena-telemetry-grid">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>COMMS FREQ</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-sky)', fontWeight: 700 }}>VHF 156.800 MHz (CH-04)</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Wifi size={14} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)', fontWeight: 700 }}>5/5 BARS</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <BatteryCharging size={14} style={{ color: 'var(--accent-amber)' }} aria-hidden="true" />
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 700 }}>84%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <section className="sena-metrics">
          <div className="sena-metric-card">
            <span>Verified Incidents</span>
            <strong>{metrics.total}</strong>
          </div>
          <div className="sena-metric-card critical">
            <span>Critical Needing Dispatch</span>
            <strong>{metrics.criticalPending}</strong>
          </div>
          <div className="sena-metric-card active">
            <span>Teams Deployed</span>
            <strong>{metrics.deployedUnits}</strong>
          </div>
          <div className="sena-metric-card ready">
            <span>Units on Standby</span>
            <strong>{metrics.availableUnits}</strong>
          </div>
        </section>

        {/* Alerts / Error feedback */}
        {errorMessage && (
          <div className="form-message error-message" role="alert">
            <AlertTriangle size={15} aria-hidden="true" /> {errorMessage}
          </div>
        )}
        {actionSuccess && (
          <div className="form-message success-message" role="status">
            <CheckCircle2 size={15} aria-hidden="true" /> {actionSuccess}
          </div>
        )}

        {/* 3-Column Tactical Command Grid */}
        <div className="sena-grid-layout">
          {/* Column 1: Incident Queue */}
          <aside className="sena-panel">
            <div className="sena-panel-header">
              <h3><Filter size={14} aria-hidden="true" /> Incident Queue</h3>
              <Badge variant="outline" className="badge">{filteredIncidents.length} shown</Badge>
            </div>

            <div className="sena-filter-box">
              <input
                type="text"
                className="sena-search-input"
                placeholder="Search locality, taluk or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="sena-filter-pills">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`sena-pill-btn ${priorityFilter === lvl ? 'active' : ''}`}
                    onClick={() => setPriorityFilter(lvl)}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="sena-filter-pills">
                {(
                  [
                    { id: 'all', label: 'All Stages' },
                    { id: 'pending_dispatch', label: 'Pending' },
                    { id: 'dispatched', label: 'Dispatched' },
                    { id: 'on_scene', label: 'On Scene' },
                    { id: 'resolved', label: 'Resolved' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`sena-pill-btn ${statusFilter === st.id ? 'active' : ''}`}
                    onClick={() => setStatusFilter(st.id as any)}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sena-incident-list">
              {filteredIncidents.length === 0 ? (
                <p className="no-reports-message">No incidents match the selected filters.</p>
              ) : (
                filteredIncidents.map((incident) => {
                  const isSelected = incident.id === selectedIncidentId
                  const currentStatus = incident.activeDispatch?.status ?? 'pending_dispatch'
                  return (
                    <button
                      key={incident.id}
                      type="button"
                      className={`sena-incident-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedIncidentId(incident.id)}
                    >
                      <div className="sena-card-top">
                        <span className="sena-card-id">{incident.id}</span>
                        <Badge
                          variant="outline"
                          className={`badge priority-badge ${incident.priority}`}
                        >
                          {incident.priority.toUpperCase()}
                        </Badge>
                      </div>

                      <h4 className="sena-card-title">{incident.summary}</h4>

                      <div className="sena-card-meta">
                        <MapPin size={12} aria-hidden="true" />
                        <span>{incident.location.label}, {incident.location.taluk}</span>
                      </div>

                      <div className="sena-needs-tags">
                        {incident.assistanceNeeds.map((need) => (
                          <span key={need} className="sena-need-tag">
                            {need.replace('_', ' ')}
                          </span>
                        ))}
                      </div>

                      <div className={`sena-dispatch-badge ${currentStatus}`}>
                        {currentStatus.replace('_', ' ')}
                        {incident.activeDispatch?.unitName ? ` &bull; ${incident.activeDispatch.unitName.split('-')[0]}` : ''}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Team Status Pulse Strip */}
            <div className="sena-pulse-strip" style={{ margin: '8px 12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={16} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
                <div>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                    TEAM STATUS PULSE
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--paper)', fontWeight: 700 }}>
                    4 RESPONDERS TELEMETRY OK
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActionSuccess('Telemetry Ping Acknowledged: All 4 responder units linked via LoRa mesh.')}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, height: '30px' }}
              >
                PING
              </Button>
            </div>
          </aside>

          {/* Column 2: Tactical Response Map */}
          <section className="sena-panel sena-map-panel">
            <div className="sena-panel-header">
              <h3><MapPin size={14} aria-hidden="true" /> Tactical Deployment Map</h3>
              <Badge variant="outline" className="badge">{units.length} Units Active</Badge>
            </div>
            <ResponseMap
              incidents={filteredIncidents}
              units={units}
              selectedIncidentId={selectedIncidentId}
              boundary={boundary}
              onSelectIncident={(id) => setSelectedIncidentId(id)}
            />
          </section>

          {/* Column 3: Command & Dispatch Action Panel */}
          <aside className="sena-panel">
            <div className="sena-panel-header">
              <h3><Shield size={14} aria-hidden="true" /> Operational Command</h3>
              {selectedIncident && (
                <Badge variant="outline" className="badge">{selectedIncident.id}</Badge>
              )}
            </div>

            {selectedIncident ? (
              <div className="sena-detail-scroll">
                {/* Incident summary card */}
                <div className="sena-incident-summary-card sena-primary-mission-card">
                  <div className="sena-glow-line" />
                  <div className="sena-card-top">
                    <span className="sena-card-id">{selectedIncident.category.toUpperCase()}</span>
                    <Badge
                      variant="outline"
                      className={`badge priority-badge ${selectedIncident.priority}`}
                    >
                      {selectedIncident.priority.toUpperCase()} PRIORITY
                    </Badge>
                  </div>

                  <h4>{selectedIncident.summary}</h4>
                  <p className="description-text">{selectedIncident.details}</p>

                  {/* Environmental Threat Warning */}
                  <div className="sena-threat-pill">
                    <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} aria-hidden="true" />
                    <div>
                      <strong style={{ display: 'block', fontSize: '11px', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        HAZARD: LIVE POWER LINE DOWN / FLOOD SURGE
                      </strong>
                      <span style={{ fontSize: '10px', color: 'var(--sage)' }}>
                        Submerged transformer 40m south. Non-contact zone active.
                      </span>
                    </div>
                  </div>

                  {/* Tactical Hazard & Souls Matrix */}
                  <div className="sena-matrix-grid">
                    <div className="sena-matrix-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--sage)', fontSize: '10px' }}>
                        <Shield size={12} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
                        <span>SOULS IN PERIL</span>
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--paper)' }}>
                        {selectedIncident.reportedImpacts.peopleTrapped ?? selectedIncident.reportedImpacts.peopleAffected ?? 5} SOULS
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--sage)' }}>2 Minors • 1 Dialysis Patient</span>
                    </div>

                    <div className="sena-matrix-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--sage)', fontSize: '10px' }}>
                        <Waves size={12} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
                        <span>WATER LEVEL</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-coral)' }}>2.1m</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--accent-coral)' }}>▲ RISING</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Flow rate: 3.4 knots</span>
                    </div>
                  </div>

                  <div className="sena-provenance-box">
                    <strong>Authority:</strong>{' '}
                    {selectedIncident.prioritySource === 'reviewer_override'
                      ? 'Human Reviewer Override'
                      : 'Automated Algorithmic Assessment'}
                    {selectedIncident.priorityReason && (
                      <p style={{ margin: '4px 0 0' }}>{selectedIncident.priorityReason}</p>
                    )}
                  </div>

                  {/* Impact Stats */}
                  <div className="sena-impact-grid">
                    <div className="sena-impact-item">
                      <span>People Affected</span>
                      <strong>{selectedIncident.reportedImpacts.peopleAffected ?? 'Unknown'}</strong>
                    </div>
                    <div className="sena-impact-item">
                      <span>People Trapped</span>
                      <strong style={{ color: selectedIncident.reportedImpacts.peopleTrapped ? 'var(--red)' : 'inherit' }}>
                        {selectedIncident.reportedImpacts.peopleTrapped ?? '0'}
                      </strong>
                    </div>
                    <div className="sena-impact-item">
                      <span>Reported Injuries</span>
                      <strong>{selectedIncident.reportedImpacts.reportedInjuries ?? '0'}</strong>
                    </div>
                    <div className="sena-impact-item">
                      <span>Vulnerable (Elderly/Kids)</span>
                      <strong>{selectedIncident.reportedImpacts.vulnerablePeople ?? '0'}</strong>
                    </div>
                  </div>

                  {/* Reporter Contact */}
                  <div className="sena-card-meta">
                    <Phone size={13} aria-hidden="true" />
                    <span>Contact: {selectedIncident.reporterName} ({selectedIncident.reporterPhone})</span>
                  </div>
                </div>

                {/* Section A: Dispatch Form (if not yet assigned) */}
                {!selectedIncident.activeDispatch ? (
                  <form className="sena-dispatch-section" onSubmit={handleDispatch}>
                    <h4><Truck size={14} aria-hidden="true" /> Authorize Team Dispatch</h4>
                    <p style={{ margin: '0', fontSize: '11px', color: 'var(--sage)' }}>
                      Select a response unit with matching capabilities to mobilize.
                    </p>

                    <div className="sena-unit-select-row">
                      {rankedUnits.map(({ unit, score, matchedCapabilities }) => {
                        const isChosen = selectedUnitId === unit.id
                        const isAvailable = unit.status === 'available'
                        return (
                          <button
                            key={unit.id}
                            type="button"
                            className={`sena-unit-option-card ${isChosen ? 'chosen' : ''}`}
                            onClick={() => setSelectedUnitId(unit.id)}
                          >
                            <div>
                              <div>
                                <strong>{unit.name}</strong> ({unit.callSign})
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>
                                {unit.personnelCount} personnel &bull; Base: {unit.baseLocation.locality}
                              </span>
                              <div style={{ marginTop: '2px', display: 'flex', gap: '3px' }}>
                                {matchedCapabilities.map((c) => (
                                  <span key={c} className="sena-need-tag">
                                    {capabilityLabels[c]?.label.split(' ')[0] ?? c}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span className="sena-unit-match-score">Match: {score}</span>
                              <div style={{ fontSize: '10px', color: isAvailable ? 'var(--tactical)' : 'var(--amber)' }}>
                                {unit.status.toUpperCase()}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <textarea
                      className="sena-textarea"
                      rows={3}
                      placeholder="Enter tactical mission brief and coordination instructions..."
                      value={missionBrief}
                      onChange={(e) => setMissionBrief(e.target.value)}
                      required
                    />

                    <Button
                      type="submit"
                      className="button button-primary"
                      disabled={isDispatching || !selectedUnitId || !missionBrief.trim()}
                    >
                      <Send size={14} aria-hidden="true" /> Mobilize &amp; Issue Dispatch Order
                    </Button>
                  </form>
                ) : (
                  /* Section B: Active Operation Coordination */
                  <div className="sena-dispatch-section">
                    <h4>
                      <Shield size={14} aria-hidden="true" /> Active Mission: #{selectedIncident.activeDispatch.id}
                    </h4>

                    <div style={{ fontSize: '12px', background: 'var(--olive)', padding: '10px', border: '1px solid var(--border)' }}>
                      <div><strong>Assigned Team:</strong> {selectedIncident.activeDispatch.unitName}</div>
                      <div><strong>Command Authorized By:</strong> {selectedIncident.activeDispatch.assignedBy}</div>
                      <div><strong>Dispatched At:</strong> {new Date(selectedIncident.activeDispatch.dispatchedAt).toLocaleTimeString()}</div>
                      <div style={{ marginTop: '4px' }}>
                        <strong>Mission Brief:</strong> &ldquo;{selectedIncident.activeDispatch.missionBrief}&rdquo;
                      </div>
                    </div>

                    {/* Glove-optimized 3-Segment Operational Pipeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--sage)', textTransform: 'uppercase' }}>
                          MISSION LIFECYCLE
                        </span>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--tactical)' }}>
                          STAGE: {selectedIncident.activeDispatch.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="sena-glove-grid">
                        <button
                          type="button"
                          className={`sena-glove-btn ${selectedIncident.activeDispatch.status === 'en_route' ? 'active' : ''}`}
                          onClick={() => handleUpdateStage('en_route')}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          <span>EN ROUTE</span>
                        </button>
                        <button
                          type="button"
                          className={`sena-glove-btn ${selectedIncident.activeDispatch.status === 'on_scene' || selectedIncident.activeDispatch.status === 'operation_underway' ? 'active' : ''}`}
                          onClick={() => handleUpdateStage('on_scene')}
                        >
                          <Shield size={16} aria-hidden="true" />
                          <span>ON SCENE</span>
                        </button>
                        <button
                          type="button"
                          className={`sena-glove-btn ${selectedIncident.activeDispatch.status === 'resolved' ? 'active' : ''}`}
                          onClick={() => handleUpdateStage('resolved')}
                        >
                          <LifeBuoy size={16} aria-hidden="true" />
                          <span>EVAC DONE</span>
                        </button>
                      </div>
                    </div>

                    {/* Secondary Field CTAs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const coords =
                            selectedIncident.location.latitude && selectedIncident.location.longitude
                              ? `${selectedIncident.location.latitude.toFixed(4)}° N, ${selectedIncident.location.longitude.toFixed(4)}° E`
                              : 'Sector 4'
                          setActionSuccess(`Offline vector map focused on ${coords}.`)
                        }}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}
                      >
                        OFFLINE MAP
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActionSuccess('AIRLIFT EXTRACTION TASKED: Indian Coast Guard ALH Helicopter en route.')
                        }}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--accent-amber)' }}
                      >
                        CALL AIRLIFT
                      </Button>
                    </div>

                    {/* Resolution Form if on scene or underway */}
                    {selectedIncident.activeDispatch.status !== 'resolved' ? (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>
                          Mission Completion / Handover:
                        </span>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="Rescued count"
                            className="sena-search-input"
                            style={{ width: '120px' }}
                            value={rescuedCountInput || ''}
                            onChange={(e) => setRescuedCountInput(parseInt(e.target.value, 10) || 0)}
                          />
                          <input
                            type="text"
                            placeholder="Handover notes..."
                            className="sena-search-input"
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="button button-quiet"
                          onClick={() => handleUpdateStage('resolved')}
                        >
                          <CheckCircle2 size={13} aria-hidden="true" /> Complete Mission &amp; Close Incident
                        </Button>
                      </div>
                    ) : (
                      <div className="sena-dispatch-badge resolved" style={{ width: '100%', textAlign: 'center', padding: '6px' }}>
                        ✓ MISSION RESOLVED &amp; ARCHIVED
                      </div>
                    )}

                    {/* Timeline & Field Logs */}
                    <div className="sena-timeline-box">
                      <span style={{ fontSize: '11px', color: 'var(--sage)' }}>Field Log &amp; Situational Updates</span>
                      {selectedIncident.activeDispatch.fieldLogs.map((log) => (
                        <div key={log.id} className="sena-log-entry">
                          <div className="sena-log-meta">
                            <span>{log.by}</span>
                            <span>{new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--paper)' }}>{log.text}</p>
                        </div>
                      ))}

                      {selectedIncident.activeDispatch.status !== 'resolved' && (
                        <form onSubmit={handleAddFieldLog} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <input
                            type="text"
                            className="sena-search-input"
                            placeholder="Enter real-time field sitrep update..."
                            value={fieldLogText}
                            onChange={(e) => setFieldLogText(e.target.value)}
                          />
                          <Button type="submit" size="sm" variant="outline" disabled={isAddingLog || !fieldLogText.trim()}>
                            Add
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--sage)' }}>
                Select an incident from the queue to review and organize response.
              </div>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}
