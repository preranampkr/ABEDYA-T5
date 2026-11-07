import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { useEffect, useMemo } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, ScaleControl, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import type { MedhaIncident } from './data/repository'
import type { MedhaPriority } from './data/intelligence'
import { formatPriority } from './data/intelligence'
import { clusterLocatedReports } from './data/mapClusters'

interface BoundaryProperties extends Record<string, unknown> {
  shapeID: string
}

interface DistrictBoundary {
  type: 'Feature'
  properties: BoundaryProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

interface ReportMapGroup {
  reports: MedhaIncident[]
  center: LatLngTuple
}

interface BoundaryExtent {
  bounds: [[number, number], [number, number]]
  center: LatLngTuple
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

function getBoundaryExtent(boundary: DistrictBoundary): BoundaryExtent {
  const positions = collectPositions(boundary.geometry.coordinates)
  const longitudes = positions.map(([longitude]) => longitude)
  const latitudes = positions.map(([, latitude]) => latitude)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  return {
    bounds: [[south, west], [north, east]],
    center: [(south + north) / 2, (west + east) / 2],
  }
}

function MapExtent({ bounds, center, hasBoundary }: {
  bounds: LatLngBoundsExpression | null
  center: LatLngTuple | null
  hasBoundary: boolean
}) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (hasBoundary && bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 })
      return
    }
    if (!center) return
    map.setView(center, 10)
  }, [bounds, center, hasBoundary, map])

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
      if (hasBoundary && bounds) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [bounds, hasBoundary, map])

  return null
}

function markerPriority(priority: MedhaPriority) {
  return `medha-marker-${priority}`
}

function reportIcon(report: MedhaIncident, priority: MedhaPriority) {
  return divIcon({
    className: 'medha-marker-icon',
    html: `<span class="medha-marker-dot ${markerPriority(priority)} medha-marker-type-${report.reportType}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function clusterIcon(count: number) {
  return divIcon({
    className: 'medha-cluster-icon',
    html: `<span>${count}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function reportPriority(report: MedhaIncident, priorities: Map<string, MedhaPriority>) {
  return priorities.get(report.id) ?? 'medium'
}

export default function IncidentMap({
  incidents,
  priorities,
  boundary,
  boundaryError,
  selectedReportId,
  onSelect,
}: {
  incidents: MedhaIncident[]
  priorities: Map<string, MedhaPriority>
  boundary: DistrictBoundary | null
  boundaryError: string
  selectedReportId: string | null
  onSelect: (reportId: string) => void
}) {
  const groups = useMemo<ReportMapGroup[]>(() => {
    const operational = incidents.filter((incident) => incident.originKind === 'user_submission')
    const demonstrations = incidents.filter((incident) => incident.originKind === 'demo')
    return [...clusterLocatedReports(operational), ...clusterLocatedReports(demonstrations)].map((reports) => ({
      reports,
      center: [
        reports.reduce((sum, report) => sum + (report.location.latitude ?? 0), 0) / reports.length,
        reports.reduce((sum, report) => sum + (report.location.longitude ?? 0), 0) / reports.length,
      ],
    }))
  }, [incidents])
  const extent = useMemo(() => boundary ? getBoundaryExtent(boundary) : null, [boundary])
  const bounds: LatLngBoundsExpression | null = extent?.bounds ?? null
  const center = extent?.center ?? groups[0]?.center ?? null
  const geoJson = boundary as unknown as GeoJsonObject | null

  if (!center) {
    return (
      <div className="medha-map-unavailable" role="status">
        <strong>{boundaryError ? 'Map geography unavailable' : 'No mappable report locations'}</strong>
        <span>{boundaryError || 'SANKET reports do not currently contain verified coordinates.'}</span>
      </div>
    )
  }

  return (
    <MapContainer center={center} zoom={8} minZoom={6} maxZoom={16} scrollWheelZoom zoomControl={false} className="medha-leaflet-map">
      <MapExtent bounds={bounds} center={center} hasBoundary={Boolean(boundary)} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundary && geoJson && (
        <GeoJSON
          key={boundary.properties.shapeID}
          data={geoJson}
          style={{ color: '#83B96B', weight: 2, fillColor: '#83B96B', fillOpacity: 0.04 }}
        />
      )}
      {groups.map((group) => group.reports.length === 1 ? (
        <Marker
          key={group.reports[0].id}
          position={group.center}
          icon={reportIcon(group.reports[0], reportPriority(group.reports[0], priorities))}
          eventHandlers={{ click: () => onSelect(group.reports[0].id) }}
          title={`${group.reports[0].id} · ${formatPriority(reportPriority(group.reports[0], priorities))}`}
          zIndexOffset={selectedReportId === group.reports[0].id ? 1000 : 0}
        >
          <Popup>
            <button type="button" className="medha-popup-link" onClick={() => onSelect(group.reports[0].id)}>
              <strong>{group.reports[0].id}</strong>
              <span>{group.reports[0].summary}</span>
              <small>{group.reports[0].originKind === 'demo' ? 'DEMO EXAMPLE · ' : ''}{formatPriority(reportPriority(group.reports[0], priorities))} priority · Open incident review</small>
            </button>
          </Popup>
        </Marker>
      ) : (
        <Marker
          key={group.reports.map((report) => report.id).join(':')}
          position={group.center}
          icon={clusterIcon(group.reports.length)}
          title={`${group.reports.length} reports within ${1.5} km`}
        >
          <Popup className="medha-cluster-popup">
            <strong>{group.reports.length} reports clustered within 1.5 km</strong>
            <div className="medha-cluster-list">
              {group.reports.map((report) => (
                <button key={report.id} type="button" className="medha-popup-link" onClick={() => onSelect(report.id)}>
                  <strong>{report.id}</strong>
                  <span>{report.summary}</span>
                  <small>{report.originKind === 'demo' ? 'DEMO EXAMPLE · ' : ''}{formatPriority(reportPriority(report, priorities))} priority · Open incident review</small>
                </button>
              ))}
            </div>
          </Popup>
        </Marker>
      ))}
      <ZoomControl position="bottomright" />
      <ScaleControl imperial={false} position="bottomleft" />
      {groups.flatMap((group) => group.reports.map((report) => {
        if (group.reports.length !== 1 || selectedReportId !== report.id) return []
        return (
          <CircleMarker
            key={`selection-${report.id}`}
            center={group.center}
            radius={15}
            pathOptions={{ color: '#E8EDE5', fillOpacity: 0, weight: 2 }}
            interactive={false}
          />
        )
      }))}
    </MapContainer>
  )
}
