import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bed,
  CheckCircle2,
  FileCheck2,
  HeartHandshake,
  Layers,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Shield,
  Truck,
  Users,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { punarjeevRepository } from './data/repository.ts'
import type {
  RehabClaimType,
  RehabRequest,
  ReliefCamp,
  ReliefSupplyCategory,
  SafeCheckin,
  SupplyItem,
} from './types'
import './punarjeev.css'

interface PunarjeevPageProps {
  role?: 'victim' | 'helper'
}

type PunarjeevTab = 'camps' | 'safe_check' | 'supplies' | 'rehab'

async function fetchPunarjeevData() {
  const [camps, supplies, checkins, rehabs] = await Promise.all([
    punarjeevRepository.getCamps(),
    punarjeevRepository.getSupplies(),
    punarjeevRepository.getSafeCheckins(),
    punarjeevRepository.getRehabRequests(),
  ])
  return { camps, supplies, checkins, rehabs }
}

export default function PunarjeevPage({ role = 'victim' }: PunarjeevPageProps) {
  const [activeMode, setActiveMode] = useState<'citizen' | 'manager'>(
    role === 'helper' ? 'manager' : 'citizen',
  )
  const [activeTab, setActiveTab] = useState<PunarjeevTab>('camps')

  // Data states
  const [camps, setCamps] = useState<ReliefCamp[]>([])
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [checkins, setCheckins] = useState<SafeCheckin[]>([])
  const [rehabs, setRehabs] = useState<RehabRequest[]>([])

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  // Camp Directory Filters
  const [selectedTaluk, setSelectedTaluk] = useState<string>('all')
  const [campSearch, setCampSearch] = useState('')

  // Bandhu Safe-Check Search & Form
  const [safeSearchQuery, setSafeSearchQuery] = useState('')
  const [checkinName, setCheckinName] = useState('')
  const [checkinPhone, setCheckinPhone] = useState('')
  const [checkinLocality, setCheckinLocality] = useState('')
  const [checkinCampId, setCheckinCampId] = useState('')
  const [checkinFamilyCount, setCheckinFamilyCount] = useState<number>(1)

  // Supply Requisition Form
  const [reqCampId, setReqCampId] = useState('')
  const [reqCategory, setReqCategory] = useState<ReliefSupplyCategory>('food_water')
  const [reqItemName, setReqItemName] = useState('')
  const [reqQuantity, setReqQuantity] = useState<number>(100)
  const [reqUnit, setReqUnit] = useState('Units')

  // Rehab Claim Form
  const [claimantName, setClaimantName] = useState('')
  const [claimantPhone, setClaimantPhone] = useState('')
  const [claimantAadhaar, setClaimantAadhaar] = useState('')
  const [claimantTaluk, setClaimantTaluk] = useState('Kundapura')
  const [claimantLocality, setClaimantLocality] = useState('')
  const [claimType, setClaimType] = useState<RehabClaimType>('house_damage')
  const [lossAmount, setLossAmount] = useState<number>(50000)
  const [claimDesc, setClaimDesc] = useState('')

  const applyData = useCallback(
    (data: {
      camps: ReliefCamp[]
      supplies: SupplyItem[]
      checkins: SafeCheckin[]
      rehabs: RehabRequest[]
    }) => {
      setCamps(data.camps)
      setSupplies(data.supplies)
      setCheckins(data.checkins)
      setRehabs(data.rehabs)
      if (data.camps.length > 0 && !checkinCampId) {
        setCheckinCampId(data.camps[0].id)
        setReqCampId(data.camps[0].id)
      }
    },
    [checkinCampId],
  )

  const loadData = useCallback(() => {
    return fetchPunarjeevData()
      .then(applyData)
      .catch((err) => {
        setFeedbackError(err instanceof Error ? err.message : 'Failed to load recovery data')
      })
      .finally(() => {
        setIsRefreshing(false)
      })
  }, [applyData])

  useEffect(() => {
    let active = true
    void fetchPunarjeevData()
      .then((data) => {
        if (!active) return
        applyData(data)
      })
      .catch((err) => {
        if (!active) return
        setFeedbackError(err instanceof Error ? err.message : 'Failed to load recovery data')
      })
    return () => {
      active = false
    }
  }, [applyData])

  const handleRefresh = () => {
    setIsRefreshing(true)
    void loadData()
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCamps = camps.length
    const totalOccupancy = camps.reduce((sum, c) => sum + c.currentOccupancy, 0)
    const totalCapacity = camps.reduce((sum, c) => sum + c.capacity, 0)
    const freeCots = Math.max(0, totalCapacity - totalOccupancy)
    const verifiedSafe = checkins.reduce((sum, c) => sum + c.familyMembersCount, 0)
    return { totalCamps, totalOccupancy, freeCots, verifiedSafe }
  }, [camps, checkins])

  // Filtered Camps
  const filteredCamps = useMemo(() => {
    return camps.filter((camp) => {
      if (selectedTaluk !== 'all' && camp.taluk.toLowerCase() !== selectedTaluk.toLowerCase()) {
        return false
      }
      if (campSearch.trim()) {
        const q = campSearch.toLowerCase()
        const matchName = camp.name.toLowerCase().includes(q)
        const matchAddr = camp.address.toLowerCase().includes(q)
        const matchTaluk = camp.taluk.toLowerCase().includes(q)
        if (!matchName && !matchAddr && !matchTaluk) return false
      }
      return true
    })
  }, [camps, selectedTaluk, campSearch])

  // Filtered Safe Checkins
  const filteredCheckins = useMemo(() => {
    if (!safeSearchQuery.trim()) return checkins
    const q = safeSearchQuery.toLowerCase()
    return checkins.filter((item) => {
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.homeLocality.toLowerCase().includes(q) ||
        item.contactPhone.includes(q) ||
        item.campName.toLowerCase().includes(q)
      )
    })
  }, [checkins, safeSearchQuery])

  // Handle Safe Checkin
  const handleSafeCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkinName.trim() || !checkinPhone.trim() || !checkinCampId) return
    setFeedbackError(null)
    setFeedbackSuccess(null)
    try {
      const result = await punarjeevRepository.addSafeCheckin({
        fullName: checkinName.trim(),
        homeLocality: checkinLocality.trim() || 'Coastal Sector',
        campId: checkinCampId,
        contactPhone: checkinPhone.trim(),
        familyMembersCount: checkinFamilyCount,
      })
      setFeedbackSuccess(`Safe check-in confirmed for ${result.fullName} (#${result.id})!`)
      setCheckinName('')
      setCheckinPhone('')
      setCheckinLocality('')
      setCheckinFamilyCount(1)
      await loadData()
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to register check-in')
    }
  }

  // Handle Supply Requisition
  const handleSupplyReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqItemName.trim() || !reqCampId) return
    setFeedbackError(null)
    setFeedbackSuccess(null)
    try {
      await punarjeevRepository.requestSupply({
        campId: reqCampId,
        category: reqCategory,
        itemName: reqItemName.trim(),
        quantity: reqQuantity,
        unit: reqUnit.trim() || 'Units',
      })
      setFeedbackSuccess(`Emergency requisition issued for ${reqItemName}!`)
      setReqItemName('')
      setReqQuantity(100)
      await loadData()
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Requisition failed')
    }
  }

  // Handle Rehab Claim Submit
  const handleRehabSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimantName.trim() || !claimantPhone.trim() || !claimDesc.trim()) return
    setFeedbackError(null)
    setFeedbackSuccess(null)
    try {
      const claim = await punarjeevRepository.submitRehabRequest({
        claimantName: claimantName.trim(),
        claimantPhone: claimantPhone.trim(),
        claimantAadhaarLast4: claimantAadhaar.trim(),
        taluk: claimantTaluk,
        locality: claimantLocality.trim() || 'Sector Floodplain',
        claimType,
        estimatedLossInr: lossAmount,
        description: claimDesc.trim(),
      })
      setFeedbackSuccess(`Rehabilitation compensation claim #${claim.id} submitted for inspection!`)
      setClaimantName('')
      setClaimantPhone('')
      setClaimantAadhaar('')
      setClaimDesc('')
      await loadData()
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Claim submission failed')
    }
  }

  // Quick Cot Reservation / Occupancy adjust
  const handleQuickAdmit = async (campId: string) => {
    const camp = camps.find((c) => c.id === campId)
    if (!camp) return
    try {
      await punarjeevRepository.updateCampOccupancy(campId, camp.currentOccupancy + 1)
      setFeedbackSuccess(`1 Cot reserved at ${camp.name}`)
      await loadData()
    } catch {
      setFeedbackError('Could not update occupancy')
    }
  }

  return (
    <DashboardLayout
      role={role}
      title="PUNARJEEV"
      description="Relief and recovery coordination, safe shelter directories, and rehabilitation."
      eyebrow={`${role.toUpperCase()} / PUNARJEEV RECOVERY`}
    >
      <div className="punarjeev-workspace">
        {/* Topbar & Operational Mission Ribbon */}
        <section className="punarjeev-topbar">
          <div className="punarjeev-title-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tactical)', fontWeight: 'bold' }}>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                CIV-RELIEF &amp; RECOVERY TELEMETRY // UDUPI DISTRICT
              </div>
              <h2>PUNARJEEV Humanitarian &amp; Shelter Command</h2>
              <p>
                Civilian intake, shelter bed capacity, Bandhu safe registry, relief supply logistics, and rehabilitation claims.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Dual Mode Switcher */}
              <div className="punarjeev-mode-switcher">
                <button
                  type="button"
                  className={`punarjeev-mode-btn ${activeMode === 'citizen' ? 'active' : ''}`}
                  onClick={() => setActiveMode('citizen')}
                >
                  <Users size={14} aria-hidden="true" /> Aid Seeker
                </button>
                <button
                  type="button"
                  className={`punarjeev-mode-btn ${activeMode === 'manager' ? 'active' : ''}`}
                  onClick={() => setActiveMode('manager')}
                >
                  <Shield size={14} aria-hidden="true" /> Camp Manager
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="button button-outline button-small"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
                Sync Grid
              </Button>
            </div>
          </div>

          {/* Telemetry Ribbon Grid */}
          <div className="punarjeev-telemetry-grid">
            <div className="punarjeev-telemetry-tile">
              <span>Active Shelters</span>
              <strong>{metrics.totalCamps} Hubs</strong>
            </div>
            <div className="punarjeev-telemetry-tile safe">
              <span>Sheltered Civilians</span>
              <strong>{metrics.totalOccupancy.toLocaleString()}</strong>
            </div>
            <div className="punarjeev-telemetry-tile alert">
              <span>Free Cots Available</span>
              <strong>{metrics.freeCots.toLocaleString()}</strong>
            </div>
            <div className="punarjeev-telemetry-tile safe">
              <span>Bandhu Safe Registry</span>
              <strong>{metrics.verifiedSafe} Souls</strong>
            </div>
            <div className="punarjeev-telemetry-tile">
              <span>Mesh Subnet Uplink</span>
              <strong style={{ fontSize: '14px', color: 'var(--tactical)' }}>LoRa 865MHz OK</strong>
            </div>
          </div>
        </section>

        {/* Operational Flash Alert Banner */}
        <section className="punarjeev-flash-banner">
          <div className="punarjeev-flash-left">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>NDMA FLASH BULLETIN:</strong> Sowparnika &amp; Varahi river outflow cresting +1.8m. Evacuees in low-lying sectors directed to high-elevation shelters immediately.
            </div>
          </div>
          <Badge variant="outline" className="badge" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
            SURGE WARNING ACTIVE
          </Badge>
        </section>

        {/* Feedback Alerts */}
        {feedbackError && (
          <div className="form-message error-message" role="alert">
            <AlertTriangle size={15} aria-hidden="true" /> {feedbackError}
          </div>
        )}
        {feedbackSuccess && (
          <div className="form-message success-message" role="status">
            <CheckCircle2 size={15} aria-hidden="true" /> {feedbackSuccess}
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="punarjeev-nav-tabs">
          <button
            type="button"
            className={`punarjeev-tab-btn ${activeTab === 'camps' ? 'active' : ''}`}
            onClick={() => setActiveTab('camps')}
          >
            <Bed size={15} aria-hidden="true" /> 1. Shelter Directory ({camps.length})
          </button>
          <button
            type="button"
            className={`punarjeev-tab-btn ${activeTab === 'safe_check' ? 'active' : ''}`}
            onClick={() => setActiveTab('safe_check')}
          >
            <Users size={15} aria-hidden="true" /> 2. Bandhu Safe-Check ({checkins.length})
          </button>
          <button
            type="button"
            className={`punarjeev-tab-btn ${activeTab === 'supplies' ? 'active' : ''}`}
            onClick={() => setActiveTab('supplies')}
          >
            <Package size={15} aria-hidden="true" /> 3. Relief Supplies ({supplies.length})
          </button>
          <button
            type="button"
            className={`punarjeev-tab-btn ${activeTab === 'rehab' ? 'active' : ''}`}
            onClick={() => setActiveTab('rehab')}
          >
            <FileCheck2 size={15} aria-hidden="true" /> 4. Rehabilitation Claims ({rehabs.length})
          </button>
        </nav>

        {/* ================= TAB 1: SHELTERS & CAMPS DIRECTORY ================= */}
        {activeTab === 'camps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="punarjeev-section-header">
              <div>
                <span style={{ fontSize: '11px', color: 'var(--sage)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  MODULE 01 // SHELTER GEO-DIRECTORY
                </span>
                <h3>Verified Community Relief Hubs</h3>
              </div>

              {/* Taluk Filter Pills */}
              <div className="punarjeev-taluk-filters">
                {(['all', 'kundapura', 'byndoor', 'udupi', 'brahmavara', 'karkala'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`punarjeev-pill ${selectedTaluk === t ? 'active' : ''}`}
                    onClick={() => setSelectedTaluk(t)}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Row */}
            <div className="punarjeev-search-row">
              <Search size={16} aria-hidden="true" style={{ color: 'var(--sage)' }} />
              <input
                type="text"
                className="punarjeev-search-input"
                placeholder="Search by shelter name, address, or landmark..."
                value={campSearch}
                onChange={(e) => setCampSearch(e.target.value)}
              />
            </div>

            {/* Camps Grid */}
            <div className="punarjeev-camps-grid">
              {filteredCamps.map((camp) => {
                const occupancyPercent = Math.round((camp.currentOccupancy / camp.capacity) * 100)
                const isNearCapacity = occupancyPercent >= 85
                const isFull = occupancyPercent >= 100

                return (
                  <article key={camp.id} className="punarjeev-camp-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="punarjeev-card-header">
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--sage)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {camp.taluk.toUpperCase()} // SECTOR SHELTER
                          </span>
                          <h4>{camp.name}</h4>
                          <span style={{ fontSize: '11px', color: 'var(--sage)' }}>{camp.address}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="badge"
                          style={{
                            borderColor: isFull ? 'var(--red)' : isNearCapacity ? 'var(--amber)' : 'var(--tactical)',
                            color: isFull ? 'var(--red)' : isNearCapacity ? 'var(--amber)' : 'var(--tactical)',
                          }}
                        >
                          {occupancyPercent}% OCCUPIED
                        </Badge>
                      </div>

                      {/* Capacity Progress Bar */}
                      <div className="punarjeev-occupancy-box">
                        <div className="punarjeev-occupancy-meta">
                          <span>
                            {camp.currentOccupancy} / {camp.capacity} Cots Occupied
                          </span>
                          <strong style={{ color: isNearCapacity ? 'var(--amber)' : 'var(--tactical)' }}>
                            {Math.max(0, camp.capacity - camp.currentOccupancy)} Available
                          </strong>
                        </div>
                        <div className="punarjeev-progress-track">
                          <div
                            className={`punarjeev-progress-fill ${isFull ? 'full' : isNearCapacity ? 'near-capacity' : ''}`}
                            style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                          />
                        </div>
                      </div>

                      {/* Camp Manager Contact */}
                      <div className="punarjeev-manager-row">
                        <div>
                          <span style={{ color: 'var(--sage)', display: 'block', fontSize: '10px' }}>Camp Manager</span>
                          <strong>{camp.managerName}</strong> ({camp.managerPhone})
                        </div>
                        <a
                          href={`tel:${camp.managerPhone.replace(/\s+/g, '')}`}
                          className="punarjeev-pill"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Phone size={12} aria-hidden="true" /> Call
                        </a>
                      </div>

                      {/* Amenities */}
                      <div className="punarjeev-amenity-tags">
                        {camp.facilities.map((fac) => (
                          <span key={fac} className="punarjeev-amenity-tag">
                            {fac}
                          </span>
                        ))}
                      </div>

                      {/* Urgent Needs Alert */}
                      {camp.urgentlyNeeded.length > 0 && (
                        <div className="punarjeev-needs-box">
                          <strong>URGENT PROVISIONS NEEDED:</strong>{' '}
                          {camp.urgentlyNeeded.map((n) => n.replace('_', ' ')).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="punarjeev-card-actions">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="button button-outline"
                        onClick={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${camp.location.latitude},${camp.location.longitude}`
                          window.open(url, '_blank')
                        }}
                      >
                        <MapPin size={13} aria-hidden="true" /> Route Map
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="button button-primary"
                        onClick={() => handleQuickAdmit(camp.id)}
                        disabled={isFull}
                      >
                        {activeMode === 'manager' ? (
                          <>+ Log Admission</>
                        ) : (
                          <>Reserve Cot &rarr;</>
                        )}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 2: BANDHU SAFE-CHECK (FAMILY LOCATOR) ================= */}
        {activeTab === 'safe_check' && (
          <div className="punarjeev-safe-grid">
            {/* Left: Search & Roster */}
            <div className="punarjeev-box-panel">
              <h4>
                <Search size={16} aria-hidden="true" /> Search Family &amp; Missing Relatives
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--sage)' }}>
                Look up relatives across all connected relief camps by name, village, or phone number.
              </p>

              <div className="punarjeev-search-row">
                <Search size={15} aria-hidden="true" style={{ color: 'var(--sage)' }} />
                <input
                  type="text"
                  className="punarjeev-search-input"
                  placeholder="Enter name (e.g. Hegde, Nayak, Bhat)..."
                  value={safeSearchQuery}
                  onChange={(e) => setSafeSearchQuery(e.target.value)}
                />
              </div>

              <div className="punarjeev-checkin-list">
                {filteredCheckins.length === 0 ? (
                  <p style={{ color: 'var(--sage)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                    No matching persons found in safe registry.
                  </p>
                ) : (
                  filteredCheckins.map((item) => (
                    <div key={item.id} className="punarjeev-checkin-card">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '13px' }}>{item.fullName}</strong>
                          <Badge variant="outline" className="badge" style={{ borderColor: 'var(--tactical)', color: 'var(--tactical)', fontSize: '9px' }}>
                            SAFE IN SHELTER
                          </Badge>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--sage)', display: 'block' }}>
                          Village: {item.homeLocality} &bull; Family count: {item.familyMembersCount}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--paper)' }}>
                          Shelter: {item.campName}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '10px', color: 'var(--sage)', display: 'block' }}>
                          {new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <a href={`tel:${item.contactPhone}`} style={{ fontSize: '11px', color: 'var(--tactical)', textDecoration: 'underline' }}>
                          {item.contactPhone}
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Register Self as Safe */}
            <form className="punarjeev-box-panel" onSubmit={handleSafeCheckinSubmit}>
              <h4>
                <HeartHandshake size={16} aria-hidden="true" /> Bandhu Safe Check-in Form
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--sage)' }}>
                Are you in a relief camp? Register your safe status so family members can confirm you are unharmed.
              </p>

              <div className="punarjeev-form-grid">
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    className="punarjeev-input-field"
                    placeholder="e.g. Ramesh Hegde"
                    value={checkinName}
                    onChange={(e) => setCheckinName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    className="punarjeev-input-field"
                    placeholder="+91 98450 XXXXX"
                    value={checkinPhone}
                    onChange={(e) => setCheckinPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Home Locality / Village</label>
                  <input
                    type="text"
                    className="punarjeev-input-field"
                    placeholder="e.g. Basrur Road, Kundapura"
                    value={checkinLocality}
                    onChange={(e) => setCheckinLocality(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Sheltered Camp *</label>
                  <select
                    className="punarjeev-input-field"
                    value={checkinCampId}
                    onChange={(e) => setCheckinCampId(e.target.value)}
                  >
                    {camps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.taluk})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Family Members Sheltered With You</label>
                  <input
                    type="number"
                    min="1"
                    className="punarjeev-input-field"
                    value={checkinFamilyCount}
                    onChange={(e) => setCheckinFamilyCount(parseInt(e.target.value, 10) || 1)}
                  />
                </div>

                <Button type="submit" className="button button-primary" style={{ marginTop: '6px' }}>
                  <CheckCircle2 size={14} aria-hidden="true" /> Confirm Safe Status on Roster
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 3: RELIEF LOGISTICS & SUPPLIES ================= */}
        {activeTab === 'supplies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="punarjeev-section-header">
              <div>
                <span style={{ fontSize: '11px', color: 'var(--sage)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  MODULE 03 // CRITICAL PROVISIONING TELEMETRY
                </span>
                <h3>Camp Relief Supplies &amp; Shortages</h3>
              </div>
            </div>

            <div className="punarjeev-supplies-grid">
              {supplies.map((item) => (
                <div key={item.id} className="punarjeev-supply-item">
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--sage)', textTransform: 'uppercase' }}>
                      {item.category.replace('_', ' ')} &bull; {item.campName.split(' ')[0]}
                    </span>
                    <h4 style={{ margin: '2px 0 0', fontSize: '14px' }}>{item.itemName}</h4>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--paper)' }}>
                      Quantity: {item.quantity.toLocaleString()} {item.unit}
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className="badge"
                    style={{
                      borderColor: item.status === 'critical' ? 'var(--red)' : item.status === 'low' ? 'var(--amber)' : 'var(--tactical)',
                      color: item.status === 'critical' ? 'var(--red)' : item.status === 'low' ? 'var(--amber)' : 'var(--tactical)',
                    }}
                  >
                    {item.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Emergency Requisition Form */}
            <form className="punarjeev-box-panel" onSubmit={handleSupplyReqSubmit} style={{ marginTop: '10px' }}>
              <h4>
                <Truck size={16} aria-hidden="true" /> Emergency Supply Requisition Desk
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--sage)' }}>
                Camp managers can requisition urgent medical, food, or fuel replenishment from central district staging.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Shelter *</label>
                  <select className="punarjeev-input-field" value={reqCampId} onChange={(e) => setReqCampId(e.target.value)}>
                    {camps.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Category *</label>
                  <select className="punarjeev-input-field" value={reqCategory} onChange={(e) => setReqCategory(e.target.value as any)}>
                    <option value="food_water">Food &amp; Clean Water</option>
                    <option value="medical_aid">Medical Aid &amp; Anti-Venom</option>
                    <option value="bedding_clothing">Bedding &amp; Blankets</option>
                    <option value="infant_care">Infant Formula &amp; Pediatric</option>
                    <option value="tools_clearance">Generator Fuel &amp; Tools</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Item Name *</label>
                  <input
                    type="text"
                    required
                    className="punarjeev-input-field"
                    placeholder="e.g. 20L Water Cans"
                    value={reqItemName}
                    onChange={(e) => setReqItemName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Quantity *</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      className="punarjeev-input-field"
                      value={reqQuantity}
                      onChange={(e) => setReqQuantity(parseInt(e.target.value, 10) || 1)}
                    />
                    <input
                      type="text"
                      className="punarjeev-input-field"
                      style={{ width: '80px' }}
                      value={reqUnit}
                      onChange={(e) => setReqUnit(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="button button-quiet" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                <Truck size={14} aria-hidden="true" /> Dispatch Supply Convoy Requisition
              </Button>
            </form>
          </div>
        )}

        {/* ================= TAB 4: REHABILITATION & LOSS CLAIMS ================= */}
        {activeTab === 'rehab' && (
          <div className="punarjeev-rehab-grid">
            {/* Left: Submit Claim Form */}
            <form className="punarjeev-box-panel" onSubmit={handleRehabSubmit}>
              <h4>
                <FileCheck2 size={16} aria-hidden="true" /> Disaster Compensation &amp; Damage Claim
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--sage)' }}>
                Submit self-service rehabilitation requests for house collapse, submerged crops, damaged fishing gear, or lost IDs.
              </p>

              <div className="punarjeev-form-grid">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Claimant Name *</label>
                    <input
                      type="text"
                      required
                      className="punarjeev-input-field"
                      placeholder="e.g. Shekhar Devadiga"
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      className="punarjeev-input-field"
                      placeholder="+91 9845X XXXXX"
                      value={claimantPhone}
                      onChange={(e) => setClaimantPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Taluk *</label>
                    <select className="punarjeev-input-field" value={claimantTaluk} onChange={(e) => setClaimantTaluk(e.target.value)}>
                      <option value="Kundapura">Kundapura</option>
                      <option value="Byndoor">Byndoor</option>
                      <option value="Udupi">Udupi</option>
                      <option value="Brahmavara">Brahmavara</option>
                      <option value="Karkala">Karkala</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Locality / Village</label>
                    <input
                      type="text"
                      className="punarjeev-input-field"
                      placeholder="e.g. Hemmady or Kodi"
                      value={claimantLocality}
                      onChange={(e) => setClaimantLocality(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Aadhaar Last 4 Digits</label>
                    <input
                      type="text"
                      maxLength={4}
                      className="punarjeev-input-field"
                      placeholder="e.g. 4892"
                      value={claimantAadhaar}
                      onChange={(e) => setClaimantAadhaar(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Claim Category *</label>
                    <select className="punarjeev-input-field" value={claimType} onChange={(e) => setClaimType(e.target.value as any)}>
                      <option value="house_damage">House Collapse / Wall Breach</option>
                      <option value="crop_livestock">Submerged Crop / Livestock</option>
                      <option value="livelihood_equipment">Boat / Fishing Net Loss</option>
                      <option value="document_loss">Lost Identity &amp; Land Deeds</option>
                      <option value="disinfection_repair">Disinfection &amp; Silt Clearing</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Estimated Loss (INR ₹)</label>
                    <input
                      type="number"
                      step="1000"
                      className="punarjeev-input-field"
                      value={lossAmount}
                      onChange={(e) => setLossAmount(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sage)', display: 'block', marginBottom: '4px' }}>Description of Damage *</label>
                  <textarea
                    rows={3}
                    required
                    className="punarjeev-input-field"
                    placeholder="Describe flood damage, water height, lost assets..."
                    value={claimDesc}
                    onChange={(e) => setClaimDesc(e.target.value)}
                  />
                </div>

                <Button type="submit" className="button button-primary">
                  <FileCheck2 size={14} aria-hidden="true" /> File Rehabilitation Claim
                </Button>
              </div>
            </form>

            {/* Right: Existing Claims Status */}
            <div className="punarjeev-box-panel">
              <h4>
                <Layers size={16} aria-hidden="true" /> Active Rehabilitation Claims
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--sage)' }}>
                Track government inspection status, surveyor allocation, and compensation sanctions.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
                {rehabs.map((claim) => (
                  <div key={claim.id} className="punarjeev-claim-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--sage)', fontFamily: 'monospace' }}>{claim.id}</span>
                        <h4 style={{ margin: '2px 0 0', fontSize: '13px' }}>{claim.claimantName}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--sage)' }}>
                          {claim.locality}, {claim.taluk} &bull; Type: {claim.claimType.replace('_', ' ')}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="badge"
                        style={{
                          borderColor: claim.status === 'approved' ? 'var(--tactical)' : claim.status === 'inspected' ? 'var(--amber)' : 'var(--sage)',
                          color: claim.status === 'approved' ? 'var(--tactical)' : claim.status === 'inspected' ? 'var(--amber)' : 'var(--sage)',
                        }}
                      >
                        {claim.status.toUpperCase()}
                      </Badge>
                    </div>

                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--paper)' }}>{claim.description}</p>

                    {claim.estimatedLossInr && (
                      <div style={{ fontSize: '11px', color: 'var(--tactical)', fontWeight: 'bold' }}>
                        Claimed Loss: ₹{claim.estimatedLossInr.toLocaleString()}
                      </div>
                    )}

                    {claim.inspectorAssigned && (
                      <div style={{ fontSize: '10px', color: 'var(--sage)', background: 'var(--panel)', padding: '4px 6px', borderRadius: '2px' }}>
                        <strong>Surveyor:</strong> {claim.inspectorAssigned}
                        {claim.approvalNotes && ` — "${claim.approvalNotes}"`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
