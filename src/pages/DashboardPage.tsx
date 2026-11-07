import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Bed,
  CheckCircle2,
  MapPin,
  Radio,
  Shield,
  Wifi,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import ModuleCard from '../components/ModuleCard'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { modulesByRole, roleLabels } from '../data/modules'
import { punarjeevStore } from '../features/punarjeev/data/punarjeevStore'
import { reportRepository } from '../features/sanket/data/reportRepository'
import type { SanketReportDraft } from '../features/sanket/types'
import SosBeacon, { type GeoTrackedCoords } from '../features/sanket/SosBeacon'
import { senaStore } from '../features/sena/data/senaStore'
import type { WorkspaceRole } from '../types/domain'

interface DashboardPageProps {
  role: WorkspaceRole
}

export default function DashboardPage({ role }: DashboardPageProps) {
  const roleLabel = roleLabels[role]
  const modules = modulesByRole[role]

  // Victim SOS State
  const [broadcastId, setBroadcastId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Helper State
  const [senaMetrics] = useState(() => {
    const units = senaStore.getUnits()
    const incidents = senaStore.getPreviewIncidents()
    return {
      total: incidents.length,
      criticalPending: incidents.filter((i) => i.priority === 'critical' && !i.activeDispatch).length,
      deployedUnits: units.filter((u) => u.status === 'deployed').length,
      availableUnits: units.filter((u) => u.status === 'available').length,
    }
  })
  const [camps] = useState(() => punarjeevStore.getCamps())
  const nearestCamp = camps[0]

  const handleTriggerSos = async (
    threat: 'flood' | 'collapse' | 'medical' | 'trapped',
    elevation: 'trapped_roof' | 'rescued_safe',
    coords?: GeoTrackedCoords,
  ) => {
    const threatLabel =
      threat === 'flood'
        ? 'Flash Flooding'
        : threat === 'collapse'
        ? 'Structural Collapse'
        : threat === 'medical'
        ? 'Medical Emergency'
        : 'Trapped Civilians'

    const sosDraft: SanketReportDraft = {
      reportType: 'sos',
      category:
        threat === 'flood'
          ? 'flooding'
          : threat === 'collapse'
          ? 'damaged_infrastructure'
          : threat === 'medical'
          ? 'medical_assistance'
          : 'shelter_required',
      urgency: 'critical',
      location: {
        label: coords ? `Citizen Live GPS Fix (±${coords.accuracy}m)` : 'Citizen LoRa Mesh Anchor (RTK-FIX)',
        locality: 'Udupi Floodplain Sector 4',
        taluk: 'Udupi',
        district: 'Udupi',
        latitude: coords?.latitude ?? 13.3408,
        longitude: coords?.longitude ?? 74.7421,
        source: 'device',
      },
      summary: `EMERGENCY SOS BEACON: ${threatLabel.toUpperCase()}`,
      details: `3-Second Instant Beacon Broadcast from Overview Hub. Elevation: ${
        elevation === 'trapped_roof' ? 'Trapped on Roof (L+2)' : 'Rescued/Safe'
      }. GNSS Position: ${coords?.latitude ?? 13.3408}° N, ${coords?.longitude ?? 74.7421}° E (±${coords?.accuracy ?? 2}m). Zero-data payload transmitted via LoRa mesh relay.`,
      reporter: {
        name: 'Citizen Beacon Caller',
        phone: '+91 94812 99999',
        contactPreference: 'phone',
      },
      reportedImpacts: {
        peopleAffected: 5,
        reportedInjuries: threat === 'medical' ? 1 : null,
        peopleTrapped: threat === 'trapped' ? 4 : 2,
        vulnerablePeople: 1,
      },
      assistanceNeeds: threat === 'medical' ? ['medical', 'rescue'] : ['rescue', 'evacuation'],
    }

    try {
      const report = await reportRepository.createReport(sosDraft)
      setBroadcastId(report.id)
      setFeedbackMessage(`Emergency SOS Beacon transmitted! SAR Unit dispatched for Incident #${report.id}.`)
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'SOS broadcast failed.')
    }
  }

  return (
    <DashboardLayout
      role={role}
      title={`${roleLabel} Overview`}
      description={
        role === 'victim'
          ? 'Emergency distress beacon, live flood telemetry, nearest shelter sanctuary, and relief modules.'
          : 'Emergency operations command overview, active response units, and triage queue.'
      }
      eyebrow={`ABHEDYA // ${roleLabel.toUpperCase()} COMMAND HUB`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ================= VICTIM OVERVIEW WORKSPACE ================= */}
        {role === 'victim' ? (
          <>
            {/* Top Telemetry & Operational Status Ribbon */}
            <div
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}
            >
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  RIVER WATER LEVEL
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                  <strong style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)' }}>14.82m</strong>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)', fontWeight: 700 }}>+18cm/h ▲</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  WEATHER INFLOW
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                  <strong style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', color: 'var(--accent-sky)' }}>88mm/h</strong>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>45kt GUSTS</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  LORA MESH UPLINK
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                  <strong style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)' }}>ONLINE</strong>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>RELAY #04 (UDUPI)</span>
                </div>
              </div>
            </div>

            {/* NDMA Evacuation Flash Alert */}
            <div
              style={{
                background: '#93000a',
                border: '1px solid #ffb4ab',
                color: '#ffdad6',
                padding: '10px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} style={{ color: '#ffb4ab', flexShrink: 0 }} aria-hidden="true" />
                <div>
                  <strong style={{ letterSpacing: '0.04em' }}>NDMA FLASH BULLETIN 04:</strong> Dam sluice gates opening at 16:00 IST. Low-lying Sector 4 evac mandatory.
                  <span style={{ display: 'block', fontSize: '10px', color: '#ffdad6', opacity: 0.85, marginTop: '2px' }}>
                    Signed: Maj. V. Nair (Incident Controller) • Udupi District Disaster Management
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="badge" style={{ borderColor: '#ffb4ab', background: '#04110a', color: '#ffb4ab', fontWeight: 800 }}>
                EVAC MANDATORY
              </Badge>
            </div>

            {feedbackMessage && (
              <div
                style={{
                  background: 'rgba(131, 185, 107, 0.15)',
                  border: '1px solid var(--tactical)',
                  color: 'var(--paper)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <CheckCircle2 size={16} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            {/* Section A: SOS Beacon Emergency Trigger */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    PRIMARY EMERGENCY TRIGGER
                  </p>
                  <h3 style={{ margin: '2px 0 0', fontSize: '18px', color: 'var(--paper)', fontFamily: 'var(--font-display)' }}>
                    SOS Rescue Beacon
                  </h3>
                </div>
                <Badge variant="outline" className="badge" style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}>
                  ZERO-DATA LORA MESH
                </Badge>
              </div>

              <SosBeacon
                onTriggerSos={handleTriggerSos}
                isBroadcasting={Boolean(broadcastId)}
                broadcastId={broadcastId}
                onCancelBroadcast={() => {
                  setBroadcastId(null)
                  setFeedbackMessage(null)
                }}
              />
            </section>

            {/* Section B: Nearest Safe Shelter Sanctuary Card */}
            {nearestCamp && (
              <section
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)', fontWeight: 800, textTransform: 'uppercase' }}>
                      NEAREST SAFE HAVEN SANCTUARY // HIGH ELEVATION
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '17px', color: 'var(--paper)' }}>{nearestCamp.name}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--sage)' }}>{nearestCamp.address} • 1.4km to Flood Line</span>
                  </div>
                  <Badge variant="outline" className="badge" style={{ borderColor: 'var(--tactical)', color: 'var(--tactical)', fontWeight: 700 }}>
                    ACCEPTING EVACUEES
                  </Badge>
                </div>

                {/* Provisions & Bunk Allocation */}
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--sage)' }}>BUNK ALLOCATION:</span>
                    <strong>
                      {nearestCamp.currentOccupancy} / {nearestCamp.capacity} BEDS ({Math.round((nearestCamp.currentOccupancy / nearestCamp.capacity) * 100)}%)
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'var(--forest)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.round((nearestCamp.currentOccupancy / nearestCamp.capacity) * 100)}%`,
                        height: '100%',
                        background: 'var(--tactical)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--sage)', paddingTop: '2px' }}>
                    <span>Available Capacity: <strong style={{ color: 'var(--tactical)' }}>{nearestCamp.capacity - nearestCamp.currentOccupancy} Beds</strong></span>
                    <span style={{ color: 'var(--accent-amber)' }}>Hot Meals • Doctor on Duty</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <Button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      const url = `https://www.google.com/maps/search/?api=1&query=${nearestCamp.location.latitude},${nearestCamp.location.longitude}`
                      window.open(url, '_blank')
                    }}
                  >
                    <MapPin size={14} aria-hidden="true" /> Get GPS Navigation Route
                  </Button>
                  <Button asChild variant="outline" className="button button-outline">
                    <Link to="/victim/punarjeev">
                      <Bed size={14} aria-hidden="true" /> Open PUNARJEEV Shelter Hub <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </section>
            )}
          </>
        ) : (
          /* ================= HELPER OVERVIEW WORKSPACE ================= */
          <>
            {/* Top Tactical Alert Banner */}
            <div
              style={{
                background: '#93000a',
                border: '1px solid #ffb4ab',
                color: '#ffdad6',
                padding: '10px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ffb4ab',
                    display: 'inline-block',
                    boxShadow: '0 0 8px #ffb4ab',
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  RED-ALERT // SURGE PHASE-3 • FLOODWATER PEAK IN T-45M
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, background: '#04110a', padding: '2px 8px', borderRadius: '4px', color: '#ffb4ab' }}>
                CRIT-4
              </span>
            </div>

            {/* EOC Key Metrics Bento Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  VERIFIED INCIDENTS
                </span>
                <strong style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--paper)', display: 'block', marginTop: '2px' }}>
                  {senaMetrics.total}
                </strong>
                <span style={{ fontSize: '10px', color: 'var(--sage)' }}>SANKET Intake Queue</span>
              </div>

              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  CRITICAL DISPATCH
                </span>
                <strong style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--accent-coral)', display: 'block', marginTop: '2px' }}>
                  {senaMetrics.criticalPending}
                </strong>
                <span style={{ fontSize: '10px', color: 'var(--accent-coral)' }}>Awaiting Unit Mobilization</span>
              </div>

              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  DEPLOYED TEAMS
                </span>
                <strong style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', display: 'block', marginTop: '2px' }}>
                  {senaMetrics.deployedUnits} Units
                </strong>
                <span style={{ fontSize: '10px', color: 'var(--sage)' }}>NDRF, SDRF, Marine Police</span>
              </div>

              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
                  SHELTERED CIVILIANS
                </span>
                <strong style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--tactical)', display: 'block', marginTop: '2px' }}>
                  3,420
                </strong>
                <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Across 5 Relief Hubs</span>
              </div>
            </div>

            {/* Active Command Unit Header */}
            <div
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(131, 185, 107, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={18} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                      UNIT-NDRF-01 • ALPHA TEAM
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--sage)', fontFamily: 'var(--font-mono)' }}>
                      COMMAND BOAT 02 • DISPATCH CONTROL STATION
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(131, 185, 107, 0.15)', color: 'var(--tactical)', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--tactical)' }} />
                  <span>DEPLOYED ON SCENE</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px', background: 'rgba(0, 0, 0, 0.25)', padding: '8px 12px', borderRadius: '6px' }}>
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
          </>
        )}

        {/* ================= PLATFORM MODULE DIRECTORY ================= */}
        <section className="module-section" aria-labelledby="module-list-title" style={{ marginTop: '8px' }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">PLATFORM MODULES</p>
              <h2 id="module-list-title">Core Response Workspaces</h2>
            </div>
            <span className="section-count">{String(modules.length).padStart(2, '0')} MODULES</span>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
