import 'leaflet/dist/leaflet.css'
import { divIcon, type LatLngTuple } from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  LocateFixed,
  Navigation,
  PhoneCall,
  Shield,
  Siren,
  Timer,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { SanketReport, SanketStatus } from './types'

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
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

function MapViewController({
  victimCoords,
  helperCoords,
  targetFocus,
}: {
  victimCoords: LatLngTuple
  helperCoords: LatLngTuple
  targetFocus: 'victim' | 'helper' | 'bounds'
}) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()
    const timer = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (targetFocus === 'victim') {
      map.flyTo(victimCoords, 14, { duration: 0.8 })
    } else if (targetFocus === 'helper') {
      map.flyTo(helperCoords, 14, { duration: 0.8 })
    } else {
      map.fitBounds([victimCoords, helperCoords], { padding: [40, 40], maxZoom: 15 })
    }
  }, [victimCoords, helperCoords, targetFocus, map])

  return null
}

interface HelperTrackingMapProps {
  report: SanketReport
  onAdvanceStatus?: (status: SanketStatus, note: string) => void
}

export default function HelperTrackingMap({
  report,
  onAdvanceStatus,
}: HelperTrackingMapProps) {
  const victimLat = report.location.latitude ?? 13.3408
  const victimLon = report.location.longitude ?? 74.7421
  const victimCoords: LatLngTuple = [victimLat, victimLon]

  // Helper live location (responder GPS or default station HQ)
  const [helperCoords, setHelperCoords] = useState<LatLngTuple>([13.3440, 74.7460])
  const [helperGpsActive, setHelperGpsActive] = useState(false)
  const [targetFocus, setTargetFocus] = useState<'victim' | 'helper' | 'bounds'>('bounds')

  // Acquire Helper's live position via browser geolocation
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setHelperCoords([pos.coords.latitude, pos.coords.longitude])
          setHelperGpsActive(true)
        },
        () => {
          // Fallback to Udupi SAR Command
          setHelperGpsActive(false)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      )
    }
  }, [])

  // Navigation metrics
  const distanceKm = useMemo(() => {
    return calculateDistanceKm(helperCoords[0], helperCoords[1], victimLat, victimLon)
  }, [helperCoords, victimLat, victimLon])

  const bearing = useMemo(() => {
    return calculateBearing(helperCoords[0], helperCoords[1], victimLat, victimLon)
  }, [helperCoords, victimLat, victimLon])

  // Estimated Travel Times
  const etaVehicleMinutes = Math.max(1, Math.round((distanceKm / 35) * 60))
  const etaFootMinutes = Math.max(2, Math.round((distanceKm / 4.5) * 60))

  const isCriticalSos = report.reportType === 'sos' || report.urgency === 'critical'

  // Turn-by-Turn GPS Navigation URL (Google Maps Direct Navigation Protocol)
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${victimLat},${victimLon}`

  return (
    <div
      className="helper-tracking-card"
      style={{
        background: 'var(--panel)',
        border: isCriticalSos ? '1px solid var(--accent-coral)' : '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* Tactical Dispatch Header Ribbon */}
      <div
        style={{
          background: isCriticalSos ? 'linear-gradient(90deg, rgba(147, 0, 10, 0.4) 0%, rgba(4, 17, 10, 0.9) 100%)' : 'var(--forest)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isCriticalSos ? 'var(--accent-coral)' : 'var(--tactical)',
              boxShadow: isCriticalSos ? '0 0 10px var(--accent-coral)' : '0 0 6px var(--tactical)',
              display: 'inline-block',
            }}
          />
          <div>
            <strong style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--paper)', letterSpacing: '0.04em' }}>
              {isCriticalSos ? 'LIVE EMERGENCY SOS LOCATOR' : 'INCIDENT GEOLOCATION VECTOR'}
            </strong>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--sage)', fontFamily: 'var(--font-mono)' }}>
              TARGET: {report.location.locality || 'Locality unverified'} ({victimLat.toFixed(4)}° N, {victimLon.toFixed(4)}° E)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(0,0,0,0.4)',
              color: 'var(--accent-sky)',
              fontWeight: 700,
            }}
          >
            BEARING {bearing.degrees}° {bearing.compass}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(0,0,0,0.4)',
              color: 'var(--tactical)',
              fontWeight: 700,
            }}
          >
            {distanceKm} KM DISTANCE
          </span>
        </div>
      </div>

      {/* Interactive Tactical Leaflet Map */}
      <div style={{ position: 'relative', width: '100%', height: '260px' }}>
        <MapContainer
          center={victimCoords}
          zoom={13}
          minZoom={8}
          maxZoom={17}
          scrollWheelZoom
          zoomControl={false}
          className="sos-beacon-map"
          style={{ width: '100%', height: '100%' }}
        >
          <MapViewController
            victimCoords={victimCoords}
            helperCoords={helperCoords}
            targetFocus={targetFocus}
          />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Accuracy circle around victim */}
          <Circle
            center={victimCoords}
            radius={Math.max(report.location.source === 'device' ? 25 : 80, 20)}
            pathOptions={{
              color: '#ffb4ab',
              fillColor: '#ffb4ab',
              fillOpacity: 0.15,
              weight: 1.5,
              dashArray: '4, 4',
            }}
          />

          {/* Direct Route Vector Line */}
          <Polyline
            positions={[helperCoords, victimCoords]}
            pathOptions={{
              color: '#7bd0ff',
              weight: 2.5,
              dashArray: '6, 6',
              opacity: 0.85,
            }}
          />

          {/* Victim Distress Marker */}
          <Marker
            position={victimCoords}
            icon={divIcon({
              className: 'victim-distress-marker',
              html: `
                <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
                  <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(255,180,171,0.4); animation:live-gps-ping 1.5s infinite ease-out;"></div>
                  <div style="width:18px; height:18px; border-radius:50%; background:#ffb4ab; border:3px solid #690005; box-shadow:0 0 14px #ffb4ab; z-index:3; display:flex; align-items:center; justify-content:center; color:#690005; font-size:10px; font-weight:900;">!</div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            })}
          >
            <Popup>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#08160f', minWidth: '160px' }}>
                <strong style={{ color: '#93000a', display: 'block', fontSize: '12px' }}>
                  🚨 CITIZEN DISTRESS LOCATION
                </strong>
                <div style={{ margin: '4px 0', fontSize: '10px' }}>
                  ID: #{report.id}<br />
                  Locality: {report.location.locality}<br />
                  Threat: {report.category}<br />
                  Trapped: {report.reportedImpacts.peopleTrapped ?? 'Reported'}<br />
                  GPS: {victimLat.toFixed(5)}° N, {victimLon.toFixed(5)}° E
                </div>
                <a
                  href={navigationUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '3px 8px',
                    background: '#00374d',
                    color: '#ffffff',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '10px',
                  }}
                >
                  Start Turn-by-Turn GPS Navigation ➔
                </a>
              </div>
            </Popup>
          </Marker>

          {/* Helper / Responder Location Pin */}
          <Marker
            position={helperCoords}
            icon={divIcon({
              className: 'helper-responder-pin',
              html: `
                <div style="background:#15231b; border:2px solid #9ed584; border-radius:6px; padding:3px 8px; font-family:monospace; font-size:9px; color:#9ed584; font-weight:800; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.6); display:flex; align-items:center; gap:4px;">
                  <span>🛡️</span> ${helperGpsActive ? 'MY UNIT (LIVE GPS)' : 'SAR BASE ALPHA'}
                </div>
              `,
              iconSize: [95, 22],
              iconAnchor: [47, 11],
            })}
          >
            <Popup>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#08160f' }}>
                <strong>Responder Unit</strong>
                <div>{helperGpsActive ? 'Field GPS Active' : 'Station HQ Position'}</div>
                <div>Distance: {distanceKm} km to victim</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Tactical Map Camera Controls */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setTargetFocus('victim')}
            title="Center camera on victim location"
            style={{
              background: 'rgba(21, 35, 27, 0.95)',
              border: '1px solid var(--accent-coral)',
              color: 'var(--paper)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            <LocateFixed size={11} style={{ color: 'var(--accent-coral)' }} />
            <span>VICTIM</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetFocus('helper')}
            title="Center camera on my responder unit"
            style={{
              background: 'rgba(21, 35, 27, 0.95)',
              border: '1px solid var(--tactical)',
              color: 'var(--paper)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            <Shield size={11} style={{ color: 'var(--tactical)' }} />
            <span>MY UNIT</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetFocus('bounds')}
            title="View both units in frame"
            style={{
              background: 'rgba(21, 35, 27, 0.95)',
              border: '1px solid var(--border)',
              color: 'var(--sage)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            <span>ROUTE FIT</span>
          </button>
        </div>

        {/* Live Vector HUD Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            zIndex: 1000,
            background: 'rgba(8, 22, 15, 0.92)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Timer size={13} style={{ color: 'var(--accent-sky)' }} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--paper)', fontWeight: 700 }}>
              ETA BOAT/VEHICLE: ~{etaVehicleMinutes}m
            </span>
          </div>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>
            ETA FOOT: ~{etaFootMinutes}m
          </span>
        </div>
      </div>

      {/* Responder Tactical Actions & Comm Links */}
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--forest)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Turn-by-Turn Navigation */}
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#00a6e0',
              color: '#00374d',
              padding: '6px 12px',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(0, 166, 224, 0.3)',
            }}
          >
            <Navigation size={13} />
            <span>NAVIGATE VIA GPS (GOOGLE MAPS)</span>
            <ExternalLink size={10} />
          </a>

          {/* Phone Call Trigger */}
          {report.reporter.phone && (
            <a
              href={`tel:${report.reporter.phone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--paper)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <PhoneCall size={12} style={{ color: 'var(--tactical)' }} />
              <span>CALL {report.reporter.phone}</span>
            </a>
          )}
        </div>

        {/* Quick Status En Route Advance */}
        {onAdvanceStatus && report.status !== 'resolved' && report.status !== 'closed' && (
          <Button
            type="button"
            size="sm"
            onClick={() => onAdvanceStatus('in_progress', `Helper mobilized toward victim GPS position (${victimLat}, ${victimLon})`)}
            style={{
              background: 'var(--tactical)',
              color: '#08160f',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: '11px',
              gap: '4px',
            }}
          >
            <Siren size={13} />
            <span>{report.status === 'assigned' ? 'DISPATCH EN ROUTE' : 'DEPLOY SQUAD'}</span>
          </Button>
        )}
      </div>
    </div>
  )
}
