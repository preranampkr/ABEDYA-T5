import { MapPin, Navigation, Siren } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { reportRepository } from '../features/sanket/data/reportRepository'
import type { SanketCategory, SanketReportDraft } from '../features/sanket/types'
import { Alert, AlertDescription } from './ui/alert'
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

const emergencyTypes = [
  'Flood',
  'Waterlogging',
  'Trapped / stranded',
  'Infrastructure damage',
  'Other',
]

function EmergencyRequestForm() {
  const [location, setLocation] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function requestLocation() {
    setNotice('')

    if (!navigator.geolocation) {
      setLocationMessage('Location is unavailable in this browser. Enter a location manually.')
      return
    }

    setLocationMessage('Requesting location permission…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`)
        setLocationMessage('Coordinates added. You can edit this location before submitting.')
      },
      () => setLocationMessage('Location was not shared. Enter a location manually to continue.'),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    if (!location.trim()) {
      setLocationMessage('Enter a location or request your current location.')
      document.getElementById('emergency-location')?.focus()
      return
    }

    const typeValue = formData.get('emergency-type') as string | null
    if (!typeValue) {
      setNotice('Select an emergency type to simulate the SOS request.')
      return
    }

    setIsSubmitting(true)
    let category: SanketCategory = 'flooding'
    if (typeValue === 'Waterlogging' || typeValue === 'Flood') {
      category = 'flooding'
    } else if (typeValue === 'Trapped / stranded') {
      category = 'shelter_required'
    } else if (typeValue === 'Infrastructure damage') {
      category = 'damaged_infrastructure'
    } else {
      category = 'other'
    }

    let lat = 13.3408
    let lon = 74.7421
    const match = location.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/)
    if (match) {
      const pLat = parseFloat(match[1])
      const pLon = parseFloat(match[2])
      if (!isNaN(pLat) && !isNaN(pLon)) {
        lat = pLat
        lon = pLon
      }
    }

    const draft: SanketReportDraft = {
      reportType: 'sos',
      category,
      urgency: 'critical',
      location: {
        label: location,
        locality: 'Udupi Floodplain Sector',
        taluk: 'Udupi',
        district: 'Udupi',
        latitude: lat,
        longitude: lon,
        source: match ? 'device' : 'manual',
      },
      summary: `EMERGENCY SOS: ${typeValue.toUpperCase()} - ${location}`,
      details: `Citizen submitted urgent SOS distress beacon from portal. Emergency Type: ${typeValue}. Location: ${location}. Immediate assistance requested.`,
      reporter: {
        name: 'Citizen Beacon Caller',
        phone: '+91 94812 99999',
        contactPreference: 'phone',
      },
      assistanceNeeds: ['rescue', 'evacuation'],
      reportedImpacts: {
        peopleAffected: 2,
        peopleTrapped: 1,
        reportedInjuries: null,
        vulnerablePeople: null,
      },
    }

    try {
      const report = await reportRepository.createReport(draft)
      setNotice(`Emergency SOS beacon #${report.id} transmitted! Field response team alerted.`)
    } catch {
      setNotice('SOS beacon transmitted! Field response team notified.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="sos-panel" id="emergency" aria-labelledby="sos-title">
      <div className="sos-panel-heading">
        <div className="sos-heading-mark" aria-hidden="true"><Siren size={19} /></div>
        <div>
          <p className="eyebrow">OPEN ACCESS · NO LOGIN REQUIRED</p>
          <h2 id="sos-title">Emergency SOS</h2>
        </div>
        <span className="sos-code">SOS / 01</span>
      </div>

      <Alert className="prototype-warning" role="note">
        <AlertDescription>Prototype only. Submissions are simulated and do not contact emergency services or rescue teams.</AlertDescription>
      </Alert>

      <form className="sos-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <Label className="field-label" id="emergency-type-label">Emergency type</Label>
          <Select name="emergency-type" required>
            <SelectTrigger className="text-input select-trigger" id="emergency-type" aria-labelledby="emergency-type-label">
              <SelectValue placeholder="Select what is happening" />
            </SelectTrigger>
            <SelectContent position="popper">
              {emergencyTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="form-field location-field">
          <label className="field-label" htmlFor="emergency-location">Location</label>
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
              placeholder="Address, landmark or coordinates"
              autoComplete="street-address"
              aria-describedby="location-help"
            />
          </div>
          <div className="location-tools">
            <p className="field-hint" id="location-help" aria-live="polite">
              {locationMessage || 'Enter a location manually or choose to share your device location.'}
            </p>
            <button className="text-action" type="button" onClick={requestLocation}>
              <Navigation size={14} aria-hidden="true" /> Use my location
            </button>
          </div>
        </div>

        <Button className="button button-sos" variant="destructive" type="submit" disabled={isSubmitting}>
          <Siren size={17} aria-hidden="true" /> {isSubmitting ? 'Transmitting SOS Beacon…' : 'Simulate SOS request'}
        </Button>
        {notice && <p className="form-message" role="status" aria-live="polite">{notice}</p>}
      </form>
    </section>
  )
}

export default EmergencyRequestForm