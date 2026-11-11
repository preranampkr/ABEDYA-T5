import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, Popup, ScaleControl, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import { AlertTriangle, CheckCircle2, Compass, Layers, LocateFixed, Send, Thermometer } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { ResponseUnit, SenaDispatchStatus, SenaIncidentItem } from './types'

export interface DistrictBoundary {
  type: 'Feature'
  properties: { shapeID: string; [key: string]: unknown }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export type BoundaryInput = DistrictBoundary | { type: 'FeatureCollection'; features: DistrictBoundary[] }

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

function extractDistrictFeature(boundary: BoundaryInput | null): DistrictBoundary | null {
  if (!boundary) return null
  if ('geometry' in boundary && boundary.geometry?.coordinates) {
    return boundary
  }
  if ('features' in boundary && Array.isArray(boundary.features)) {
    return (
      boundary.features.find((item) => item?.properties?.shapeID === '76128533B4839184447445') ??
      boundary.features.find((item) => Boolean(item?.geometry?.coordinates)) ??
      null
    )
  }
  return null
}

function getBoundaryExtent(boundary: BoundaryInput | null) {
  const feature = extractDistrictFeature(boundary)
  if (!feature?.geometry?.coordinates) return null
  const positions = collectPositions(feature.geometry.coordinates)
  if (positions.length === 0) return null
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
  selectedLat,
  selectedLon,
  focusRequest,
  externalFocusNonce,
}: {
  bounds: LatLngBoundsExpression | null
  selectedLat: number | null
  selectedLon: number | null
  focusRequest: { target: 'incident' | 'hq'; nonce: number } | null
  externalFocusNonce: number
}) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()
    if (selectedLat !== null && selectedLon !== null) {
      map.flyTo([selectedLat, selectedLon], 13, { duration: 0.7 })
      return
    }
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 })
    }
  }, [bounds, map, selectedLat, selectedLon])

  useEffect(() => {
    if (!focusRequest) return
    map.invalidateSize()
    if (focusRequest.target === 'incident' && selectedLat !== null && selectedLon !== null) {
      map.flyTo([selectedLat, selectedLon], 14, { duration: 0.7 })
    } else if (focusRequest.target === 'hq') {
      if (bounds) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 })
      } else {
        map.flyTo([13.3408, 74.7421], 11, { duration: 0.7 })
      }
    }
  }, [bounds, focusRequest, map, selectedLat, selectedLon])

  useEffect(() => {
    if (externalFocusNonce <= 0) return
    map.invalidateSize()
    if (selectedLat !== null && selectedLon !== null) {
      map.flyTo([selectedLat, selectedLon], 14, { duration: 0.7 })
    }
  }, [externalFocusNonce, map, selectedLat, selectedLon])

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 180)
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
  externalFocusNonce = 0,
  onSelectIncident,
  onFocusCommand,
}: {
  incidents: SenaIncidentItem[]
  units: ResponseUnit[]
  selectedIncidentId: string | null
  boundary: BoundaryInput | null
  externalFocusNonce?: number
  onSelectIncident: (id: string) => void
  onFocusCommand?: () => void
}) {
  const districtFeature = useMemo(() => extractDistrictFeature(boundary), [boundary])
  const extent = useMemo(() => getBoundaryExtent(districtFeature), [districtFeature])
  const bounds = extent?.bounds ?? null
  const defaultCenter: LatLngTuple = extent?.center ?? [13.45, 74.75]

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId],
  )

  const selectedLat = selectedIncident?.location.latitude ?? null
  const selectedLon = selectedIncident?.location.longitude ?? null

  const [focusRequest, setFocusRequest] = useState<{ target: 'incident' | 'hq'; nonce: number } | null>(null)

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

  const availableUnitsCount = useMemo(() => units.filter((u) => u.status === 'available').length, [units])
  const dispatchedCount = useMemo(
    () => incidents.filter((i) => i.activeDispatch && i.activeDispatch.status !== 'resolved').length,
    [incidents],
  )
  const pendingCount = useMemo(
    () => incidents.filter((i) => !i.activeDispatch || i.activeDispatch.status === 'pending_dispatch').length,
    [incidents],
  )

  return (
    <div className="sena-map-wrapper" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '560px' }}>
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
            QUEUE PENDING
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)' }}>{pendingCount}</strong>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', fontWeight: 700 }}>AWAITING SAR</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
            ACTIVE MISSIONS
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-sky)' }}>{dispatchedCount}</strong>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>EN ROUTE / SCENE</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', textTransform: 'uppercase', display: 'block' }}>
            FORCE READINESS
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>{availableUnitsCount}/{units.length}</strong>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)' }}>STANDBY</span>
          </div>
        </div>
      </div>

      {/* Dedicated Relative Map Stage Wrapper so overlays align cleanly inside the map area */}
      <div style={{ position: 'relative', flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: '480px' }}>
        {/* Floating Tactical Deck Right Controls */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 1000,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setFocusRequest((prev) => ({ target: 'incident', nonce: (prev?.nonce ?? 0) + 1 }))
              triggerToast(
                selectedIncident
                  ? `Focused on Incident ${selectedIncident.id}`
                  : 'Compass Aligned North',
              )
            }}
            title="Center on Selected Incident"
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
              triggerToast(showHazards ? 'District & Vector Overlays Hidden' : 'District & Vector Overlays Enabled')
            }}
            title="Toggle District & Vector Overlays"
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
              triggerToast(showThermal ? 'High-Contrast Palette Deactivated' : 'High-Contrast Palette Active')
            }}
            title="Toggle High-Contrast Thermal Palette"
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
            onClick={() => {
              setFocusRequest((prev) => ({ target: 'hq', nonce: (prev?.nonce ?? 0) + 1 }))
              triggerToast('Centered on Udupi District Overview')
            }}
            title="Reset View to District Overview"
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

        {/* Live Selected Coordinates Readout */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(8, 22, 15, 0.88)',
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
            {selectedLat !== null && selectedLon !== null
              ? `POS: ${selectedLat.toFixed(4)}° N, ${selectedLon.toFixed(4)}° E`
              : 'DISTRICT: UDUPI ADM2'}
          </span>
          <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>
            {selectedIncident
              ? `${selectedIncident.id} • ${selectedIncident.location.locality || selectedIncident.location.taluk || 'Udupi'}`
              : `${incidents.length} Incidents • ${units.length} SAR Units`}
          </span>
        </div>

        {/* Interactive Toast Popup */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
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
              whiteSpace: 'nowrap',
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
          style={{
            flex: '1 1 auto',
            width: '100%',
            minHeight: '480px',
            filter: showThermal ? 'hue-rotate(180deg) saturate(1.8)' : 'none',
          }}
        >
          <MapViewSync
            bounds={bounds}
            selectedLat={selectedLat}
            selectedLon={selectedLon}
            focusRequest={focusRequest}
            externalFocusNonce={externalFocusNonce}
          />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {districtFeature && showHazards && (
          <GeoJSON
            key={districtFeature.properties?.shapeID ?? 'udupi-district'}
            data={districtFeature as unknown as GeoJsonObject}
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
                        onClick={() => {
                          onSelectIncident(incident.id)
                          onFocusCommand?.()
                        }}
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
      </div>

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
                <span style={{ fontSize: '10px', color: 'var(--sage)' }}>
                  • {selectedIncident.location.locality || selectedIncident.location.label || 'Udupi'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--paper)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {selectedIncident.summary}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            className="button button-primary"
            onClick={() => {
              onSelectIncident(selectedIncident.id)
              onFocusCommand?.()
            }}
            style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, height: '30px' }}
          >
            <Send size={12} aria-hidden="true" />
            {selectedIncident.activeDispatch ? 'COMMAND' : 'DISPATCH'}
          </Button>
        </div>
      )}
    </div>
  )
}
