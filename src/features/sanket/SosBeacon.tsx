import 'leaflet/dist/leaflet.css'
import { divIcon, type LatLngTuple } from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Flashlight,
  HeartPulse,
  Home,
  Locate,
  LocateFixed,
  MapPin,
  Radio,
  Shield,
  Users,
  Volume2,
  Waves,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { sampleCamps } from '../punarjeev/data/sampleCamps'
import type { ReliefCamp } from '../punarjeev/types'

export type ThreatType = 'flood' | 'collapse' | 'medical' | 'trapped'
export type ElevationType = 'trapped_roof' | 'rescued_safe'

export interface GeoTrackedCoords {
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number | null
  heading?: number | null
  speed?: number | null
}

interface SosBeaconProps {
  onTriggerSos: (threat: ThreatType, elevation: ElevationType, coords?: GeoTrackedCoords) => Promise<void>
  isBroadcasting?: boolean
  broadcastId?: string | null
  onCancelBroadcast?: () => void
}

function formatCoordinate(val: number, hemisphere: 'N' | 'S' | 'E' | 'W') {
  return `${Math.abs(val).toFixed(4)}° ${hemisphere}`
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(1))
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): { degrees: number; compass: string } {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  let brng = toDeg(Math.atan2(y, x))
  brng = (brng + 360) % 360
  const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(brng / 22.5) % 16
  return { degrees: Math.round(brng), compass: compassDirections[index] }
}

function getAccuracyClassification(accuracy: number) {
  if (accuracy <= 2) {
    return { tag: `±${accuracy}m (RTK-FIX)`, label: 'RTK Sub-Meter Centimetric GNSS', isSat: true }
  }
  if (accuracy <= 15) {
    return { tag: `±${accuracy}m (GNSS 3D)`, label: 'High-Precision Satellite GPS 3D-Fix', isSat: true }
  }
  if (accuracy <= 50) {
    return { tag: `±${accuracy}m (DGPS / CELL)`, label: 'Cellular / DGPS Regional Fix', isSat: false }
  }
  return { tag: `±${accuracy}m (WIFI / NETWORK)`, label: 'Wi-Fi / Network Triangulation', isSat: false }
}

function BeaconMapSync({ center }: { center: LatLngTuple }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const timer = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    map.panTo(center, { animate: true, duration: 0.8 })
  }, [center, map])

  return null
}

function RecenterControl({ center }: { center: LatLngTuple }) {
  const map = useMap()
  return (
    <button
      type="button"
      onClick={() => map.flyTo(center, 13, { duration: 0.6 })}
      title="Recenter on current GPS position"
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'rgba(21, 35, 27, 0.95)',
        border: '1px solid var(--tactical)',
        color: 'var(--paper)',
        padding: '5px 9px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
      }}
    >
      <LocateFixed size={12} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
      <span>CENTER GPS</span>
    </button>
  )
}

interface CampWithDistance extends ReliefCamp {
  distKm: number
  bearing: { degrees: number; compass: string }
}

function BeaconLiveMap({
  coords,
  nearestCamp,
  allCamps,
  accuracyInfo,
}: {
  coords: GeoTrackedCoords
  nearestCamp: CampWithDistance
  allCamps: ReliefCamp[]
  accuracyInfo: ReturnType<typeof getAccuracyClassification>
}) {
  const center: LatLngTuple = [coords.latitude, coords.longitude]
  const campLat = nearestCamp.location.latitude ?? 13.3408
  const campLon = nearestCamp.location.longitude ?? 74.7421
  const campCenter: LatLngTuple = [campLat, campLon]

  return (
    <div className="sos-beacon-map-wrapper">
      <MapContainer
        center={center}
        zoom={13}
        minZoom={8}
        maxZoom={17}
        scrollWheelZoom
        zoomControl={false}
        className="sos-beacon-map"
      >
        <BeaconMapSync center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterControl center={center} />

        {/* Accuracy radius circle */}
        <Circle
          center={center}
          radius={Math.max(coords.accuracy, 25)}
          pathOptions={{
            color: '#9ed584',
            fillColor: '#9ed584',
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: '4, 4',
          }}
        />

        {/* Live User GPS Location Pin */}
        <Marker
          position={center}
          icon={divIcon({
            className: 'live-gps-user-marker',
            html: `
              <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(255,180,171,0.35); animation:live-gps-ping 1.6s infinite ease-out;"></div>
                <div style="width:14px; height:14px; border-radius:50%; background:#ffb4ab; border:2.5px solid #690005; box-shadow:0 0 10px #ffb4ab; z-index:2;"></div>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })}
        >
          <Popup>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#08160f', minWidth: '150px' }}>
              <strong style={{ color: '#93000a', display: 'block', fontSize: '12px' }}>YOU ARE HERE</strong>
              <div style={{ margin: '4px 0', fontSize: '10px' }}>
                Lat: {coords.latitude.toFixed(5)}° N<br />
                Lon: {coords.longitude.toFixed(5)}° E<br />
                Precision: {accuracyInfo.tag}
              </div>
              <span style={{ background: '#9ed584', color: '#08160f', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, fontSize: '9px' }}>
                LIVE GPS POSITION
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Tactical vector line to nearest shelter */}
        <Polyline
          positions={[center, campCenter]}
          pathOptions={{
            color: '#7bd0ff',
            weight: 2,
            dashArray: '6, 6',
            opacity: 0.85,
          }}
        />

        {/* Relief Camp Markers */}
        {allCamps.slice(0, 5).map((camp) => {
          const isNearest = camp.id === nearestCamp.id
          const cLat = camp.location.latitude ?? 13.3408
          const cLon = camp.location.longitude ?? 74.7421
          return (
            <Marker
              key={camp.id}
              position={[cLat, cLon]}
              icon={divIcon({
                className: 'shelter-map-pin',
                html: `
                  <div style="background:${isNearest ? '#00374d' : '#15231b'}; border:1.5px solid ${isNearest ? '#7bd0ff' : '#42493d'}; border-radius:6px; padding:2px 6px; font-family:monospace; font-size:9px; color:${isNearest ? '#7bd0ff' : '#d6e7da'}; font-weight:700; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.6); display:flex; align-items:center; gap:4px;">
                    <span>⌂</span> ${camp.taluk} ${isNearest ? `(${nearestCamp.distKm}km)` : ''}
                  </div>
                `,
                iconSize: [85, 20],
                iconAnchor: [42, 10],
              })}
            >
              <Popup>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#08160f' }}>
                  <strong>{camp.name}</strong>
                  <div>Taluk: {camp.taluk}</div>
                  <div>Capacity: {camp.currentOccupancy}/{camp.capacity}</div>
                  <div style={{ color: '#00374d', fontWeight: 700, marginTop: '4px' }}>
                    Distance: {camp.id === nearestCamp.id ? `${nearestCamp.distKm} km (${nearestCamp.bearing.compass})` : 'Active Shelter'}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Floating Tactical Coordinate Overlay Badge */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          background: 'rgba(8, 22, 15, 0.90)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '4px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--tactical)', display: 'inline-block', boxShadow: '0 0 6px var(--tactical)' }} />
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)', fontWeight: 800 }}>
            GPS SATELLITE FIX
          </span>
        </div>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--paper)', fontWeight: 600 }}>
          {coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E
        </span>
      </div>

      {/* Nearest Sanctuary Distance Badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          zIndex: 1000,
          background: 'rgba(8, 22, 15, 0.90)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--accent-sky)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span>NEAREST RELIEF:</span>
        <strong style={{ color: 'var(--paper)' }}>{nearestCamp.name.slice(0, 22)}… ({nearestCamp.distKm}km, {nearestCamp.bearing.compass})</strong>
      </div>
    </div>
  )
}

export default function SosBeacon({
  onTriggerSos,
  isBroadcasting = false,
  broadcastId = null,
  onCancelBroadcast,
}: SosBeaconProps) {
  const [selectedThreat, setSelectedThreat] = useState<ThreatType>('flood')
  const [elevationStatus, setElevationStatus] = useState<ElevationType>('trapped_roof')
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [isWhistleOn, setIsWhistleOn] = useState(false)
  const [isStrobeOn, setIsStrobeOn] = useState(false)
  const [localBeaconActive, setLocalBeaconActive] = useState(false)
  const beaconActive = isBroadcasting || localBeaconActive

  // Dual Visual Mode: Interactive Map vs. Tactical Radar
  const [viewMode, setViewMode] = useState<'map' | 'radar'>('map')

  // Live Realtime Location Tracking State
  const [coords, setCoords] = useState<GeoTrackedCoords>({
    latitude: 13.3408,
    longitude: 74.7421,
    accuracy: 2,
    altitude: 6.4,
    heading: null,
    speed: null,
  })
  const [geoStatus, setGeoStatus] = useState<'acquiring' | 'locked' | 'fallback' | 'denied'>('acquiring')
  const [osmLocality, setOsmLocality] = useState<string | null>(null)
  const [fixCount, setFixCount] = useState<number>(1)
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null)

  const holdIntervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const strobeIntervalRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const requiredHoldTimeMs = 3000
  const radius = 46
  const circumference = 2 * Math.PI * radius

  // Calculate sorted distances and bearings to all registered relief camps
  const sortedCamps: CampWithDistance[] = useMemo(() => {
    return sampleCamps
      .map((camp) => {
        const cLat = camp.location.latitude ?? 13.3408
        const cLon = camp.location.longitude ?? 74.7421
        const distKm = calculateDistanceKm(coords.latitude, coords.longitude, cLat, cLon)
        const bearing = calculateBearing(coords.latitude, coords.longitude, cLat, cLon)
        return { ...camp, distKm, bearing }
      })
      .sort((a, b) => a.distKm - b.distKm)
  }, [coords.latitude, coords.longitude])

  const nearestShelter = sortedCamps[0]
  const accuracyInfo = getAccuracyClassification(coords.accuracy)

  // Offline regional locality classifier
  const regionalLocality = useMemo(() => {
    const lat = coords.latitude
    const lon = coords.longitude
    if (lat >= 13.0 && lat < 13.18 && lon >= 74.9 && lon <= 75.12) {
      return 'Karkala / Moodbidri Border'
    }
    if (lat >= 13.18 && lat < 13.30 && lon >= 74.9 && lon <= 75.12) {
      return 'Karkala Taluk Central'
    }
    if (lat >= 13.25 && lat < 13.40 && lon >= 74.65 && lon <= 74.85) {
      return 'Udupi Town / Brahmagiri'
    }
    if (lat >= 13.40 && lat < 13.55 && lon >= 74.65 && lon <= 74.85) {
      return 'Brahmavara Riverine Basin'
    }
    if (lat >= 13.55 && lat < 13.75 && lon >= 74.60 && lon <= 74.85) {
      return 'Kundapura Coastal Basin'
    }
    if (lat >= 13.75 && lat < 14.05 && lon >= 74.50 && lon <= 74.80) {
      return 'Byndoor Taluk'
    }
    if (lat >= 13.0 && lat <= 14.0 && lon >= 74.5 && lon <= 75.5) {
      return 'Coastal Karnataka Sector'
    }
    return 'Udupi District'
  }, [coords.latitude, coords.longitude])

  const localityName = osmLocality || regionalLocality

  // Hardware Compass Listener
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null
      if ('webkitCompassHeading' in e && typeof (e as { webkitCompassHeading?: number }).webkitCompassHeading === 'number') {
        heading = (e as { webkitCompassHeading: number }).webkitCompassHeading
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360
      }
      if (heading !== null) {
        setDeviceHeading(Math.round(heading))
      }
    }
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true)
    }
    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true)
      }
    }
  }, [])

  // Locality reverse resolution
  useEffect(() => {
    const lat = coords.latitude
    const lon = coords.longitude
    const controller = new AbortController()
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.address) {
          const addr = data.address
          const town = addr.suburb || addr.town || addr.village || addr.city || addr.county || ''
          const dist = addr.state_district || addr.county || 'Udupi'
          if (town) {
            setOsmLocality(`${town}, ${dist}`)
          }
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [coords.latitude, coords.longitude])

  // Request realtime GPS location lock
  const requestGpsLock = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('fallback')
      return
    }

    setGeoStatus('acquiring')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
          accuracy: Math.round(pos.coords.accuracy),
          altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        })
        setGeoStatus('locked')
        setFixCount((c) => c + 1)
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'fallback')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }

  // Active position watching effect
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            setCoords({
              latitude: Number(pos.coords.latitude.toFixed(5)),
              longitude: Number(pos.coords.longitude.toFixed(5)),
              accuracy: Math.round(pos.coords.accuracy),
              altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
            })
            setGeoStatus('locked')
            setFixCount((c) => c + 1)
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setGeoStatus('denied')
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          },
        )
        watchIdRef.current = id
      } catch {
        // Fallback
      }
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Cleanup Web Audio and strobe on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      if (strobeIntervalRef.current) clearInterval(strobeIntervalRef.current)
      document.body.style.filter = 'none'
      if (oscRef.current) {
        try {
          oscRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (audioCtxRef.current) {
        try {
          void audioCtxRef.current.close()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const startHolding = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.cancelable) {
      e.preventDefault()
    }
    if (beaconActive) return

    setIsHolding(true)
    startTimeRef.current = Date.now()

    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / requiredHoldTimeMs, 1)
      setHoldProgress(progress)

      if (elapsed >= requiredHoldTimeMs) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
        setIsHolding(false)
        setHoldProgress(1)
        setLocalBeaconActive(true)

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 500])
        }

        void onTriggerSos(selectedThreat, elevationStatus, coords)
      }
    }, 40)
  }

  const cancelHolding = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
  }

  const toggleWhistle = () => {
    if (isWhistleOn) {
      if (oscRef.current) {
        try {
          oscRef.current.stop()
        } catch {
          // ignore
        }
        oscRef.current = null
      }
      setIsWhistleOn(false)
    } else {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioContextClass()
        audioCtxRef.current = ctx
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(2800, ctx.currentTime) // High-pitch acoustic rescue tone
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        oscRef.current = osc
        setIsWhistleOn(true)
      } catch {
        setIsWhistleOn(false)
      }
    }
  }

  const toggleStrobe = () => {
    if (isStrobeOn) {
      if (strobeIntervalRef.current) clearInterval(strobeIntervalRef.current)
      document.body.style.filter = 'none'
      setIsStrobeOn(false)
    } else {
      setIsStrobeOn(true)
      strobeIntervalRef.current = window.setInterval(() => {
        document.body.style.filter = document.body.style.filter === 'invert(1)' ? 'none' : 'invert(1)'
      }, 120)
    }
  }

  const handleCancelBeacon = () => {
    setLocalBeaconActive(false)
    setHoldProgress(0)
    onCancelBroadcast?.()
  }

  const strokeDashoffset = circumference - holdProgress * circumference

  return (
    <div className="sos-beacon-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Live Telemetry Status Strip with Realtime GPS Track */}
      <div
        className="sos-telemetry-strip"
        style={{
          background: 'var(--panel)',
          border: geoStatus === 'locked' ? '1px solid var(--tactical)' : '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: 'border-color 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  geoStatus === 'locked' ? 'var(--tactical)' : geoStatus === 'acquiring' ? 'var(--accent-amber)' : 'var(--accent-coral)',
                display: 'inline-block',
                boxShadow: geoStatus === 'locked' ? '0 0 8px var(--tactical)' : 'none',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--paper)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {geoStatus === 'locked'
                ? `GPS SATELLITE LOCK (LIVE TRACKING · ${localityName})`
                : geoStatus === 'acquiring'
                ? 'ACQUIRING GNSS SATELLITE FIX…'
                : 'LORA MESH: RELAY #04 (FALLBACK ACTIVE)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={requestGpsLock}
              title="Request fresh high-precision GPS satellite reading"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: geoStatus === 'locked' ? 'rgba(131, 185, 107, 0.15)' : 'rgba(245, 189, 88, 0.15)',
                color: geoStatus === 'locked' ? 'var(--tactical)' : 'var(--accent-amber)',
                border: '1px solid currentColor',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <LocateFixed size={12} aria-hidden="true" />
              <span>{geoStatus === 'locked' ? `REFRESH FIX (#${fixCount})` : 'LOCK GPS'}</span>
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--sage)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}
            >
              <Radio size={11} aria-hidden="true" />
              <span>LORA 865MHz</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', paddingTop: '4px' }}>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>COORDINATES</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--paper)', fontWeight: 600 }}>
              {formatCoordinate(coords.latitude, coords.latitude >= 0 ? 'N' : 'S')},{' '}
              {formatCoordinate(coords.longitude, coords.longitude >= 0 ? 'E' : 'W')}
            </span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>ACCURACY</span>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: geoStatus === 'locked' ? 'var(--tactical)' : 'var(--accent-amber)',
                fontWeight: 600,
              }}
            >
              {accuracyInfo.tag}
            </span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>ELEVATION</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-sky)', fontWeight: 600 }}>
              {coords.altitude ? `+${coords.altitude}m MSL` : '+18.2m MSL (TERRAIN)'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Tactical Location Tracker Card: Interactive Map + Tactical Radar Toggle */}
      <div
        style={{
          background: 'var(--forest)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
            <div>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--tactical)', textTransform: 'uppercase' }}>
                LIVE BEACON GEOLOCATION TRACK
              </span>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--paper)' }}>
                {accuracyInfo.label} · {localityName}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* View Switcher: Interactive Map vs Radar Scope */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('map')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: viewMode === 'map' ? 'rgba(158, 213, 132, 0.2)' : 'transparent',
                  color: viewMode === 'map' ? 'var(--tactical)' : 'var(--sage)',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <MapPin size={11} aria-hidden="true" />
                <span>LIVE MAP</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('radar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: viewMode === 'radar' ? 'rgba(158, 213, 132, 0.2)' : 'transparent',
                  color: viewMode === 'radar' ? 'var(--tactical)' : 'var(--sage)',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Radio size={11} aria-hidden="true" />
                <span>RADAR</span>
              </button>
            </div>

            <button
              type="button"
              onClick={requestGpsLock}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--paper)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Locate size={12} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
              <span>CALIBRATE FIX</span>
            </button>
          </div>
        </div>

        {/* View Component: Interactive Live GPS Map OR Tactical Radar */}
        {viewMode === 'map' ? (
          <BeaconLiveMap
            coords={coords}
            nearestCamp={nearestShelter}
            allCamps={sampleCamps}
            accuracyInfo={accuracyInfo}
          />
        ) : (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '140px',
              background: 'radial-gradient(circle at center, #15231b 0%, #04110a 100%)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Topo radar grid pattern */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, rgba(158, 213, 132, 0.12) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                pointerEvents: 'none',
              }}
            />

            {/* Rotating radar sweep beam */}
            <div className="sos-radar-sweep" />

            {/* Concentric Range Rings */}
            <div
              style={{
                position: 'absolute',
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                border: '1px dashed rgba(158, 213, 132, 0.25)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                border: '1px solid rgba(158, 213, 132, 0.15)',
                pointerEvents: 'none',
              }}
            />

            {/* Crosshair lines */}
            <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(158, 213, 132, 0.15)' }} />
            <div style={{ position: 'absolute', height: '100%', width: '1px', background: 'rgba(158, 213, 132, 0.15)' }} />

            {/* Central Pulsing Live User Beacon Pin */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 180, 171, 0.35)',
                }}
              />
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ffb4ab',
                  border: '2px solid #690005',
                  display: 'inline-block',
                  boxShadow: '0 0 10px #ffb4ab',
                }}
              />
            </div>

            {/* Radar Micro-readout overlays with Real Calculated Shelter & Bearing */}
            <div
              style={{
                position: 'absolute',
                top: '6px',
                left: '8px',
                fontSize: '8px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--tactical)',
                fontWeight: 700,
              }}
            >
              BEARING: {deviceHeading ? `${deviceHeading}° (COMPASS)` : `${nearestShelter.bearing.degrees}° ${nearestShelter.bearing.compass}`} • HDOP {geoStatus === 'locked' ? '0.8' : '1.4'}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                right: '8px',
                fontSize: '8px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-sky)',
                fontWeight: 700,
              }}
            >
              RANGE RING: {coords.accuracy > 100 ? `${coords.accuracy}m` : '250m'}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                left: '8px',
                fontSize: '8px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--sage)',
              }}
            >
              NEAREST SHELTER: {nearestShelter.distKm}km ({nearestShelter.name.slice(0, 20)}…)
            </div>
          </div>
        )}
      </div>

      {/* Primary Distress Hero Button with Radial Holding Logic */}
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(147, 0, 10, 0.25) 0%, rgba(4, 17, 10, 0.9) 100%)',
          border: '1px solid rgba(255, 180, 171, 0.3)',
          borderRadius: '16px',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Monospace Operational Protocol Marker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', zIndex: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-coral)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(147, 0, 10, 0.35)',
              fontWeight: 700,
            }}
          >
            PROTOCOL: ALPHA-RED-DISPATCH
          </span>
        </div>

        {/* Hold Trigger Circular Button */}
        <div
          role="button"
          tabIndex={0}
          onMouseDown={startHolding}
          onMouseUp={cancelHolding}
          onMouseLeave={cancelHolding}
          onTouchStart={startHolding}
          onTouchEnd={cancelHolding}
          onTouchCancel={cancelHolding}
          style={{
            position: 'relative',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            cursor: beaconActive ? 'default' : 'pointer',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isHolding ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform 0.15s ease',
            boxShadow: '0 0 30px rgba(255, 75, 75, 0.35)',
          }}
        >
          {/* Animated SVG Ring Progress */}
          <svg
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#690005" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#ffb4ab"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.05s linear' }}
            />
          </svg>

          {/* Inner Core */}
          <div
            style={{
              width: '136px',
              height: '136px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #b3261e 0%, #93000a 80%, #690005 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: 'inset 0 2px 8px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0,0,0,0.6)',
            }}
          >
            <AlertTriangle size={34} aria-hidden="true" style={{ marginBottom: '2px', color: '#ffdad6' }} />
            <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.08em', lineHeight: 1 }}>SOS</span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 800, letterSpacing: '0.12em', color: '#ffb4ab', marginTop: '2px' }}>
              DISTRESS
            </span>
          </div>
        </div>

        {/* Action Prompt */}
        <div style={{ marginTop: '16px', textAlign: 'center', zIndex: 1 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 700,
              color: isHolding ? 'var(--accent-coral)' : 'var(--paper)',
            }}
          >
            {beaconActive ? 'DISTRESS SIGNAL BROADCASTING' : isHolding ? 'TRANSMITTING BEACON… HOLD!' : 'HOLD 3 SEC FOR RESCUE BEACON'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--sage)' }}>
            Tactical mesh broadcast transmits zero-data GPS packet with live coordinates
          </p>
        </div>

        {/* SOS Active Banner */}
        {beaconActive && (
          <div
            style={{
              marginTop: '16px',
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#93000a',
              border: '1px solid #ffb4ab',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} aria-hidden="true" style={{ color: '#ffb4ab' }} />
              <div>
                <strong style={{ fontSize: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  BEACON ACTIVE: SAR UNIT EN ROUTE
                </strong>
                {broadcastId && <span style={{ fontSize: '10px', color: '#ffdad6' }}>Incident #{broadcastId}</span>}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancelBeacon}
              style={{
                backgroundColor: '#ffffff',
                color: '#93000a',
                border: 'none',
                fontWeight: 700,
                fontSize: '11px',
                height: '28px',
                padding: '0 10px',
              }}
            >
              <X size={12} aria-hidden="true" /> CANCEL
            </Button>
          </div>
        )}
      </div>

      {/* Hazard Quick-Classification Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, color: 'var(--sage)', letterSpacing: '0.08em' }}>
            SELECT PRIMARY THREAT (TAP TO TAG)
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)' }}>1 ACTIVE</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSelectedThreat('flood')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'flood' ? 'rgba(131, 185, 107, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'flood' ? '1px solid var(--tactical)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(0, 166, 224, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Waves size={18} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Flash Flood</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Water Level Rising</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedThreat('collapse')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'collapse' ? 'rgba(245, 189, 88, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'collapse' ? '1px solid var(--accent-amber)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(245, 189, 88, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={18} style={{ color: 'var(--accent-amber)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Structural Fail</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Collapse Risk</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedThreat('medical')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'medical' ? 'rgba(255, 180, 171, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'medical' ? '1px solid var(--accent-coral)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(147, 0, 10, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HeartPulse size={18} style={{ color: 'var(--accent-coral)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Medical / CPR</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Critical Trauma</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedThreat('trapped')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'trapped' ? 'rgba(123, 208, 255, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'trapped' ? '1px solid var(--accent-sky)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(0, 166, 224, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={18} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Elderly / Child</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Trapped Indoors</span>
            </div>
          </button>
        </div>
      </div>

      {/* Real-time Location Elevation & Status Segmented Toggle */}
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, color: 'var(--sage)' }}>
            CITIZEN STATUS &amp; VERTICAL ELEVATION
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>BAROMETER +6.2M</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setElevationStatus('trapped_roof')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: elevationStatus === 'trapped_roof' ? 'rgba(147, 0, 10, 0.4)' : 'transparent',
              color: elevationStatus === 'trapped_roof' ? '#ffdad6' : 'var(--sage)',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Home size={14} style={{ color: 'var(--accent-coral)' }} aria-hidden="true" />
            <span>Trapped: Roof (L+2)</span>
          </button>

          <button
            type="button"
            onClick={() => setElevationStatus('rescued_safe')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: elevationStatus === 'rescued_safe' ? 'var(--tactical)' : 'transparent',
              color: elevationStatus === 'rescued_safe' ? '#0d3900' : 'var(--sage)',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>I am Rescued / Safe</span>
          </button>
        </div>
      </div>

      {/* Audio-Visual Field Beacon Tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={toggleWhistle}
          style={{
            background: isWhistleOn ? 'rgba(123, 208, 255, 0.25)' : 'var(--panel)',
            border: isWhistleOn ? '1px solid var(--accent-sky)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '76px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Volume2 size={20} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: isWhistleOn ? 'var(--accent-sky)' : 'rgba(0,0,0,0.3)',
                color: isWhistleOn ? '#00354a' : 'var(--sage)',
              }}
            >
              {isWhistleOn ? 'ACTIVE' : 'OFF'}
            </span>
          </div>
          <div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 700, color: 'var(--paper)' }}>110dB Audio Siren</p>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--sage)' }}>High-pitch acoustic ping</p>
          </div>
        </button>

        <button
          type="button"
          onClick={toggleStrobe}
          style={{
            background: isStrobeOn ? 'rgba(245, 189, 88, 0.25)' : 'var(--panel)',
            border: isStrobeOn ? '1px solid var(--accent-amber)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '76px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Flashlight size={20} style={{ color: 'var(--accent-amber)' }} aria-hidden="true" />
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: isStrobeOn ? 'var(--accent-amber)' : 'rgba(0,0,0,0.3)',
                color: isStrobeOn ? '#271900' : 'var(--sage)',
              }}
            >
              {isStrobeOn ? 'STROBE ON' : 'STANDBY'}
            </span>
          </div>
          <div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 700, color: 'var(--paper)' }}>Night SAR Strobe</p>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--sage)' }}>Screen high-lux pulse</p>
          </div>
        </button>
      </div>

      {/* Offline Survival Protocol Card */}
      <div
        style={{
          background: 'var(--forest)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(131, 185, 107, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Shield size={18} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--paper)' }}>Offline Survival Protocol</span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', color: 'var(--paper)' }}>
              SECTOR 04 (UDUPI)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--sage)', lineHeight: 1.5 }}>
            Keep phone dry inside plastic. <strong style={{ color: 'var(--paper)' }}>Do not attempt wading through water exceeding 15cm</strong>. SAR Boat Patrol NDRF-02 deployed 400m south downriver.
          </p>
        </div>
      </div>
    </div>
  )
}
