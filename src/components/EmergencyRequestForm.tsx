import { CheckCircle2, Clock, MapPin, Navigation, Phone, RotateCcw, ShieldAlert, Siren, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { sanketRepository } from '../features/sanket/data/sanketRepository'
import type { SanketAssistanceNeed, SanketCategory, SanketReport, SanketReportDraft } from '../features/sanket/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

const emergencyTypes: { label: string; category: SanketCategory; needs: SanketAssistanceNeed[] }[] = [
  { label: 'Flood / Rapid Inundation', category: 'flooding', needs: ['rescue', 'evacuation'] },
  { label: 'Waterlogging / Stagnant Water', category: 'waterlogging', needs: ['food_water'] },
  { label: 'Trapped / Stranded Persons', category: 'other', needs: ['rescue', 'evacuation'] },
  { label: 'Damaged Infrastructure / Bridge', category: 'damaged_infrastructure', needs: ['transport'] },
  { label: 'Medical Emergency in Flood Zone', category: 'medical_assistance', needs: ['medical', 'rescue'] },
  { label: 'Other Emergency', category: 'other', needs: ['other'] },
]

export function EmergencyRequestForm() {
  const [location, setLocation] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const [selectedTypeLabel, setSelectedTypeLabel] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [situationDetails, setSituationDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submittedReport, setSubmittedReport] = useState<SanketReport | null>(null)

  function requestLocation() {
    setErrorMessage('')

    if (!navigator.geolocation) {
      setLocationMessage('Geolocation unavailable in this browser. Please enter location manually.')
      return
    }

    setLocationMessage('Requesting GPS coordinates…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`)
        setLocationMessage('Coordinates acquired via GPS.')
      },
      () => setLocationMessage('Location permission denied. Please enter address or landmark manually.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setErrorMessage('')

    if (!location.trim()) {
      setLocationMessage('Please enter a location or click "Use my location".')
      document.getElementById('emergency-location')?.focus()
      return
    }

    if (!selectedTypeLabel) {
      setErrorMessage('Please select an emergency type.')
      return
    }

    const matchedType = emergencyTypes.find((t) => t.label === selectedTypeLabel) || emergencyTypes[0]

    // Attempt to extract lat/lon coordinates if provided in "lat, lon" format
    let latitude: number | undefined
    let longitude: number | undefined
    const coordsMatch = location.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/)
    if (coordsMatch) {
      latitude = parseFloat(coordsMatch[1])
      longitude = parseFloat(coordsMatch[3])
    }

    const draft: SanketReportDraft = {
      reportType: 'sos',
      category: matchedType.category,
      urgency: 'critical',
      location: {
        label: location.trim(),
        locality: location.trim().split(',')[0] || 'Udupi Region',
        taluk: 'Udupi',
        district: 'Udupi',
        latitude,
        longitude,
        source: latitude && longitude ? 'device' : 'manual',
      },
      reporter: {
        name: reporterName.trim() || 'Anonymous SOS Citizen',
        phone: reporterPhone.trim() || 'Not provided',
        contactPreference: reporterPhone.trim() ? 'phone' : 'none',
      },
      assistanceNeeds: matchedType.needs,
      summary: `EMERGENCY SOS: ${matchedType.label}`,
      details: situationDetails.trim() || `Urgent assistance requested at ${location.trim()}.`,
    }

    setIsSubmitting(true)

    try {
      const result = await sanketRepository.submitReport(draft)
      setSubmittedReport(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error: Unable to record emergency report.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setSubmittedReport(null)
    setLocation('')
    setLocationMessage('')
    setSelectedTypeLabel('')
    setReporterName('')
    setReporterPhone('')
    setSituationDetails('')
    setErrorMessage('')
  }

  return (
    <section className="sos-panel" id="emergency" aria-labelledby="sos-title">
      <div className="sos-panel-heading">
        <div className="sos-heading-mark" aria-hidden="true">
          <Siren size={19} />
        </div>
        <div>
          <p className="eyebrow">OPEN ACCESS · EMERGENCY RESPONSE</p>
          <h2 id="sos-title">Emergency SOS</h2>
        </div>
        <span className="sos-code">SOS / SANKET</span>
      </div>

      {!isSupabaseConfigured && (
        <Alert className="prototype-warning" role="note" style={{ marginBottom: '14px' }}>
          <AlertTitle style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} /> Backend Configuration Notice
          </AlertTitle>
          <AlertDescription>
            Live database credentials (<code>VITE_SUPABASE_URL</code> &amp; <code>VITE_SUPABASE_ANON_KEY</code>) are not configured in <code>.env</code>. Submissions will be registered in local browser memory with tracking IDs, but will not dispatch to live emergency authorities.
          </AlertDescription>
        </Alert>
      )}

      {submittedReport ? (
        <div
          className="sos-success-card"
          style={{
            padding: '20px',
            background: 'var(--olive, #1c2620)',
            border: '1px solid #16a34a',
            borderRadius: '4px',
            color: 'var(--paper, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#4ade80' }}>
            <CheckCircle2 size={24} aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Distress Signal Registered</h3>
          </div>

          <div style={{ background: '#0f1712', padding: '14px', borderRadius: '4px', margin: '14px 0', border: '1px solid #2d4534' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Incident Tracking ID</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#facc15', letterSpacing: '0.08em', marginTop: '4px' }}>
              {submittedReport.id}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '8px' }}>
              <strong>Type:</strong> {submittedReport.summary}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
              <strong>Location:</strong> {submittedReport.location.label}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {new Date(submittedReport.createdAt).toLocaleTimeString()} · Status: <span style={{ color: '#f59e0b', fontWeight: 600 }}>INCOMING</span>
            </div>
          </div>

          <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#cbd5e1' }}>
            Save this tracking ID. Field responders and district coordinators can reference <strong>{submittedReport.id}</strong> in SANKET to verify your location and dispatch status.
          </p>

          <Button
            type="button"
            variant="outline"
            className="button button-outline"
            style={{ marginTop: '16px', width: '100%' }}
            onClick={handleReset}
          >
            <RotateCcw size={15} aria-hidden="true" /> Submit another emergency request
          </Button>
        </div>
      ) : (
        <form className="sos-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <Label className="field-label" id="emergency-type-label">
              Emergency type *
            </Label>
            <Select
              value={selectedTypeLabel}
              onValueChange={setSelectedTypeLabel}
              required
              disabled={isSubmitting}
            >
              <SelectTrigger
                className="text-input select-trigger"
                id="emergency-type"
                aria-labelledby="emergency-type-label"
              >
                <SelectValue placeholder="Select what is happening" />
              </SelectTrigger>
              <SelectContent position="popper">
                {emergencyTypes.map((type) => (
                  <SelectItem key={type.label} value={type.label}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="form-field location-field">
            <Label className="field-label" htmlFor="emergency-location">
              Location or Landmark *
            </Label>
            <div className="location-input-wrap">
              <MapPin className="input-leading-icon" size={17} aria-hidden="true" />
              <Input
                className="text-input location-input"
                id="emergency-location"
                name="location"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value)
                  setLocationMessage(event.target.value ? 'Location entered manually.' : '')
                }}
                placeholder="Village, road, bridge, landmark or GPS coordinates"
                autoComplete="street-address"
                aria-describedby="location-help"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="location-tools">
              <p className="field-hint" id="location-help" aria-live="polite">
                {locationMessage || 'Enter a location manually or use device GPS.'}
              </p>
              <button
                className="text-action"
                type="button"
                onClick={requestLocation}
                disabled={isSubmitting}
              >
                <Navigation size={14} aria-hidden="true" /> Use my location
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <Label className="field-label" htmlFor="emergency-contact">
                Contact phone (Optional)
              </Label>
              <div className="location-input-wrap">
                <Phone className="input-leading-icon" size={16} aria-hidden="true" />
                <Input
                  className="text-input"
                  id="emergency-contact"
                  type="tel"
                  placeholder="Mobile number"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-field">
              <Label className="field-label" htmlFor="emergency-name">
                Your name (Optional)
              </Label>
              <div className="location-input-wrap">
                <User className="input-leading-icon" size={16} aria-hidden="true" />
                <Input
                  className="text-input"
                  id="emergency-name"
                  type="text"
                  placeholder="Full name"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  autoComplete="name"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="form-field">
            <Label className="field-label" htmlFor="emergency-details">
              Situation details (Optional)
            </Label>
            <Input
              className="text-input"
              id="emergency-details"
              placeholder="e.g. Water level rising, 4 family members including an infant stranded"
              value={situationDetails}
              onChange={(e) => setSituationDetails(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <Button
            className="button button-sos"
            variant="destructive"
            type="submit"
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <Siren size={17} aria-hidden="true" className={isSubmitting ? 'animate-pulse' : ''} />
            {isSubmitting ? 'Transmitting emergency signal…' : 'Submit Emergency SOS'}
          </Button>

          {errorMessage && (
            <p className="form-message" style={{ color: '#f87171' }} role="alert">
              {errorMessage}
            </p>
          )}
        </form>
      )}
    </section>
  )
}

export default EmergencyRequestForm
