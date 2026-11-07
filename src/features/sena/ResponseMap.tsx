import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { useEffect, useMemo } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, Popup, ScaleControl, TileLayer, ZoomControl, useMap } from 'react-leaflet'
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

  return (
    <div className="sena-map-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={9}
        minZoom={7}
        maxZoom={16}
        scrollWheelZoom
        zoomControl={false}
        className="sena-leaflet-map"
      >
        <MapViewSync bounds={bounds} selectedCoords={selectedCoords} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {boundary && (
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
        {dispatchVectors.map((v) => (
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
    </div>
  )
}
