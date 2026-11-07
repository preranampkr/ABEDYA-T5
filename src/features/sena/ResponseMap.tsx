import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, Popup, ScaleControl, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import { AlertTriangle, CheckCircle2, Compass, Layers, LocateFixed, Send, Thermometer } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { ResponseUnit, SenaDispatchStatus, SenaIncidentItem } from './types'

interface DistrictBoundary {
  type: 'Feature'
  properties: { shapeID: string; [key: string]: unknown }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

interface DispatchVector {
  incidentId: string
  status: SenaDispatchStatus | undefined
  positions: LatLngTuple[]
}

function collectPositions(value: unknown, positions: number[][] = []): number[][] {
  if (!Array.isArray(value)) return positions
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    positions.push(value as number[])
    return positions
  }
  for (const item of value) collectPositions(item, positions)
  return positions
}

function getBoundaryExtent(boundary: DistrictBoundary) {
  const positions = collectPositions(boundary.geometry.coordinates)
  const longitudes = positions.map(([longitude]) => longitude)
  const latitudes = positions.map(([, latitude]) => latitude)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  return {
    bounds: [[south, west], [north, east]] as [[number, number], [number, number]],
    center: [(south + north) / 2, (west + east) / 2] as LatLngTuple,
  }
}

function MapViewSync({
  bounds,
  selectedCoords,
}: {
  bounds: LatLngBoundsExpression | null
  selectedCoords: LatLngTuple | null
}) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (selectedCoords) {
      map.flyTo(selectedCoords, 13, { duration: 0.8 })
      return
    }
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 })
    }
  }, [bounds, map, selectedCoords])

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])

  return null
}

function incidentMarkerIcon(incident: SenaIncidentItem, isSelected: boolean) {
  const isCritical = incident.priority === 'critical'
  const isHigh = incident.priority === 'high'
  const bgClass = isCritical
    ? 'sena-pin-critical'
    : isHigh
      ? 'sena-pin-high'
      : incident.priority === 'medium'
        ? 'sena-pin-medium'
        : 'sena-pin-low'

  const selectedClass = isSelected ? 'sena-pin-selected' : ''
  const dispatchClass = incident.activeDispatch ? `sena-dispatched-${incident.activeDispatch.status}` : ''

  return divIcon({
    className: 'sena-incident-div-icon',
    html: `
      <div class="sena-map-pin ${bgClass} ${selectedClass} ${dispatchClass}">
        <span class="sena-pin-dot"></span>
        ${isCritical ? '<span class="sena-pin-pulse"></span>' : ''}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function unitMarkerIcon(unit: ResponseUnit) {
  const isAvailable = unit.status === 'available'
  const colorClass = isAvailable ? 'sena-unit-avail' : 'sena-unit-busy'
  return divIcon({
    className: 'sena-unit-div-icon',
    html: `
      <div class="sena-unit-marker ${colorClass}">
        <span class="sena-unit-symbol">&#9650;</span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

export default function ResponseMap({
  incidents,
  units,
  selectedIncidentId,
  boundary,
  onSelectIncident,
}: {
  incidents: SenaIncidentItem[]
  units: ResponseUnit[]
  selectedIncidentId: string | null
  boundary: DistrictBoundary | null
  onSelectIncident: (id: string) => void
}) {
  const extent = useMemo(() => (boundary ? getBoundaryExtent(boundary) : null), [boundary])
  const bounds = extent?.bounds ?? null
  const defaultCenter: LatLngTuple = extent?.center ?? [13.45, 74.75]

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  )

  const selectedCoords: LatLngTuple | null = useMemo(() => {
    if (selectedIncident?.location.latitude && selectedIncident?.location.longitude) {
      return [selectedIncident.location.latitude, selectedIncident.location.longitude]
    }
    return null
  }, [selectedIncident])

  // Pairs of coordinates for dispatch vector lines
  const dispatchVectors = useMemo(() => {
    const list: DispatchVector[] = []
    for (const incident of incidents) {
      if (!incident.activeDispatch || !incident.location.latitude || !incident.location.longitude) continue
      const unit = units.find((u) => u.id === incident.activeDispatch?.unitId)
      if (!unit || !unit.currentLocation.latitude || !unit.currentLocation.longitude) continue
      list.push({
        incidentId: incident.id,
        status: incident.activeDispatch.status,
        positions: [
          [unit.currentLocation.latitude, unit.currentLocation.longitude],
          [incident.location.latitude, incident.location.longitude],
        ],
      })
    }
    return list
  }, [incidents, units])

  const [showThermal, setShowThermal] = useState(false)
  const [showHazards, setShowHazards] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2400)
  }

  return (
    <div className="sena-map-wrapper" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Operational Status Bar Ribbon */}
      <div
        style={{
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          zIndex: 5,
        }}
      >
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
            RIVER LEVEL
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)' }}>14.82m</strong>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)', fontWeight: 700 }}>+18cm/h</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
            WEATHER INFLOW
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-sky)' }}>88mm/h</strong>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>45kt</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
            DISTRESS / RESCUE
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>{incidents.length}</strong>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)' }}>{units.length} ASN</span>
          </div>
        </div>
      </div>

      {/* Floating Tactical Deck Right Controls */}
      <div
        style={{
          position: 'absolute',
          top: '64px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 1000,
        }}
      >
        <button
          type="button"
          onClick={() => triggerToast('Compass Heading Calibrated to True North')}
          title="Align True North"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--tactical)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '8px', color: 'var(--accent-coral)', fontWeight: 800, lineHeight: 1 }}>N</span>
          <Compass size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowHazards(!showHazards)
            triggerToast(showHazards ? 'Hazards & Vector Overlays Hidden' : 'Hazards & Vector Overlays Enabled')
          }}
          title="Toggle Hazard Layers"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: showHazards ? 'rgba(123, 208, 255, 0.2)' : 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--accent-sky)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Layers size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowThermal(!showThermal)
            triggerToast(showThermal ? 'FLIR Thermal Palette Deactivated' : 'FLIR Thermal Palette Active')
          }}
          title="Toggle Thermal Recon"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: showThermal ? 'rgba(245, 189, 88, 0.25)' : 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--accent-amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Thermometer size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => triggerToast('GPS RTK Centered on Udupi Operations HQ')}
          title="Center HQ"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--paper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Map Coordinate Crosshairs Monospace */}
      <div
        style={{
          position: 'absolute',
          top: '64px',
          left: '12px',
          background: 'rgba(8, 22, 15, 0.85)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '4px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--tactical)' }}>
          GRID: 43Q-ND-1907-7287
        </span>
        <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>
          ELEV: +16.4m MSL • HDOP 0.8m
        </span>
      </div>

      {/* Interactive Toast Popup */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--panel)',
            border: '1px solid var(--tactical)',
            color: 'var(--paper)',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            zIndex: 1500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={14} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={9}
        minZoom={7}
        maxZoom={16}
        scrollWheelZoom
        zoomControl={false}
        className="sena-leaflet-map"
        style={{ filter: showThermal ? 'hue-rotate(180deg) saturate(1.8)' : 'none' }}
      >
        <MapViewSync bounds={bounds} selectedCoords={selectedCoords} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {boundary && showHazards && (
          <GeoJSON
            key={boundary.properties.shapeID}
            data={boundary as unknown as GeoJsonObject}
            style={{
              color: '#83b96b',
              weight: 1.5,
              opacity: 0.65,
              fillColor: '#22372b',
              fillOpacity: 0.12,
            }}
          />
        )}

        {/* Tactical dispatch vector lines */}
        {showHazards &&
          dispatchVectors.map((v) => (
            <Polyline
              key={`vector-${v.incidentId}`}
              positions={v.positions}
              pathOptions={{
                color: v.status === 'on_scene' ? '#83b96b' : '#d9a441',
                weight: 2,
                dashArray: '6, 8',
                opacity: 0.75,
              }}
            />
          ))}

        {/* Response Units */}
        {units.map((unit) => {
          if (!unit.currentLocation.latitude || !unit.currentLocation.longitude) return null
          return (
            <Marker
              key={unit.id}
              position={[unit.currentLocation.latitude, unit.currentLocation.longitude]}
              icon={unitMarkerIcon(unit)}
            >
              <Popup className="sena-popup">
                <div className="sena-popup-content">
                  <span className="sena-popup-tag unit-tag">{unit.agency} &bull; {unit.callSign}</span>
                  <h4>{unit.name}</h4>
                  <p><strong>Leader:</strong> {unit.leader}</p>
                  <p><strong>Status:</strong> {unit.status.toUpperCase()} ({unit.personnelCount} crew)</p>
                  <p><strong>Base:</strong> {unit.baseLocation.label}</p>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Incidents */}
        {incidents.map((incident) => {
          if (!incident.location.latitude || !incident.location.longitude) return null
          const isSelected = incident.id === selectedIncidentId
          return (
            <Marker
              key={incident.id}
              position={[incident.location.latitude, incident.location.longitude]}
              icon={incidentMarkerIcon(incident, isSelected)}
              eventHandlers={{
                click: () => onSelectIncident(incident.id),
              }}
            >
              <Popup className="sena-popup">
                <div className="sena-popup-content">
                  <span className={`sena-popup-tag priority-${incident.priority}`}>
                    {incident.priority.toUpperCase()} PRIORITY
                  </span>
                  <h4>{incident.summary}</h4>
                  <p><strong>Location:</strong> {incident.location.label}, {incident.location.taluk}</p>
                  <p><strong>Needs:</strong> {incident.assistanceNeeds.join(', ')}</p>
                  {incident.activeDispatch ? (
                    <div className="sena-popup-dispatch-status">
                      <span>Assigned to: {incident.activeDispatch.unitName}</span>
                      <em>Status: {incident.activeDispatch.status.replace('_', ' ').toUpperCase()}</em>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="sena-popup-select-btn"
                      onClick={() => onSelectIncident(incident.id)}
                    >
                      Assign &amp; Dispatch Team &rarr;
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" imperial={false} />
      </MapContainer>

      {/* Real-time Incident Details Inspection Flyout Banner */}
      {selectedIncident && (
        <div
          style={{
            background: 'var(--panel)',
            borderTop: '1px solid var(--border)',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(147, 0, 10, 0.3)',
                color: 'var(--accent-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={16} aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: 'var(--accent-coral)' }}>
                  {selectedIncident.id} • {selectedIncident.priority.toUpperCase()} EVAC
                </span>
                <span style={{ fontSize: '10px', color: 'var(--sage)' }}>• {selectedIncident.location.locality}</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--paper)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {selectedIncident.summary}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            className="button button-primary"
            onClick={() => onSelectIncident(selectedIncident.id)}
            style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, height: '30px' }}
          >
            <Send size={12} aria-hidden="true" /> DISPATCH
          </Button>
        </div>
      )}
    </div>
  )
}
