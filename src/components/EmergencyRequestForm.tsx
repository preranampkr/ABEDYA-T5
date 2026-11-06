import { MapPin, Navigation, Siren } from 'lucide-react'
import { useState, type FormEvent } from 'react'
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    if (!location.trim()) {
      setLocationMessage('Enter a location or request your current location.')
      document.getElementById('emergency-location')?.focus()
      return
    }

    if (!formData.get('emergency-type')) {
      setNotice('Select an emergency type to simulate the SOS request.')
      return
    }

    setNotice('Simulation complete. No emergency services or rescue teams were contacted.')
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

        <Button className="button button-sos" variant="destructive" type="submit">
          <Siren size={17} aria-hidden="true" /> Simulate SOS request
        </Button>
        {notice && <p className="form-message" role="status" aria-live="polite">{notice}</p>}
      </form>
    </section>
  )
}

export default EmergencyRequestForm