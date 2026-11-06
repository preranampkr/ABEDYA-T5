import 'leaflet/dist/leaflet.css'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudRain,
  Database,
  ExternalLink,
  Info,
  Layers3,
  MapPinned,
  Navigation,
  ShieldAlert,
  Waves,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, ScaleControl, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import DashboardLayout from '../../components/DashboardLayout'
import StatusIndicator from '../../components/StatusIndicator'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { drishtiProviders, taluks } from './data/providers'
import type {
  DataMode,
  DataSourceStatus,
  GeographicFeature,
  RainfallObservation,
  WeatherObservation,
} from './types'
import './drishti.css'

type BoundaryProperties = Record<string, unknown> & {
  shapeName: string
  shapeID: string
  shapeType: string
  unitName: string
  boundaryYearRepresented: number
}

type DistrictBoundary = GeographicFeature<BoundaryProperties>
type BoundaryCollection = { type: 'FeatureCollection'; features: DistrictBoundary[] }
type SectionId = 'situation' | 'geospatial' | 'rainfall' | 'river' | 'risk' | 'alerts'

const sections: { id: SectionId; label: string; icon: typeof Activity; description: string }[] = [
  { id: 'situation', label: 'District Situation', icon: Activity, description: 'Current district-level status and source availability.' },
  { id: 'geospatial', label: 'Geospatial Intelligence', icon: Layers3, description: 'Boundary provenance, geography selection, and available map layers.' },
  { id: 'rainfall', label: 'Rainfall & Weather', icon: CloudRain, description: 'Rainfall and weather observations with source and freshness.' },
  { id: 'river', label: 'River Monitoring', icon: Waves, description: 'River gauge coverage and level observations.' },
  { id: 'risk', label: 'Flood Risk Intelligence', icon: ShieldAlert, description: 'Historical susceptibility, current conditions, warnings, and preliminary indicators.' },
  { id: 'alerts', label: 'Alerts & Preparedness', icon: AlertTriangle, description: 'Official warning availability and preparedness references.' },
]

const sectionTitles: Record<SectionId, string> = {
  situation: 'District Situation',
  geospatial: 'Geospatial Intelligence',
  rainfall: 'Rainfall & Weather',
  river: 'River Monitoring',
  risk: 'Flood Risk Intelligence',
  alerts: 'Alerts & Preparedness',
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

function boundaryExtent(feature: DistrictBoundary): { center: LatLngTuple; bounds: LatLngBoundsExpression } {
  const positions = collectPositions(feature.geometry.coordinates)
  const longitudes = positions.map(([longitude]) => longitude)
  const latitudes = positions.map(([, latitude]) => latitude)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)

  return {
    center: [(south + north) / 2, (west + east) / 2],
    bounds: [[south, west], [north, east]],
  }
}

function FitDistrict({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 })
  }, [bounds, map])

  return null
}

function formatTime(value: string | undefined) {
  if (!value) return 'Unavailable'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value))
}

function LayerToggle({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  disabled?: boolean
  label: string
  onChange?: (checked: boolean) => void
}) {
  const id = `layer-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <div className={`drishti-layer-row${disabled ? ' is-unavailable' : ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <label htmlFor={id}>
        <span className="drishti-layer-label">{label}</span>
        <span className="drishti-layer-description">{description}</span>
      </label>
      {disabled && <span className="drishti-layer-state">N/A</span>}
    </div>
  )
}

function ModeButton({ mode, active, onClick, children }: { mode: DataMode; active: boolean; onClick: (mode: DataMode) => void; children: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      className={`drishti-mode-button${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={() => onClick(mode)}
    >
      {children}
    </Button>
  )
}

function ObservationValue({ rainfall, weather }: { rainfall?: RainfallObservation; weather?: WeatherObservation }) {
  if (!rainfall && !weather) return null

  return (
    <div className="drishti-observation-grid">
      {rainfall && (
        <div className="drishti-measurement">
          <div className="drishti-measurement-label"><CloudRain size={15} aria-hidden="true" /> Rainfall sample</div>
          <strong>{rainfall.value.toFixed(1)} <small>{rainfall.units}</small></strong>
          <span>{formatTime(rainfall.observedAt)} · {rainfall.source.label}</span>
        </div>
      )}
      {weather && (
        <div className="drishti-measurement">
          <div className="drishti-measurement-label"><Activity size={15} aria-hidden="true" /> Weather sample</div>
          <strong>{weather.value.temperature.toFixed(1)} <small>°C</small></strong>
          <span>{weather.value.relativeHumidity}% RH · wind {weather.value.windSpeed.toFixed(1)} km/h</span>
          <span>{formatTime(weather.observedAt)} · {weather.source.label}</span>
        </div>
      )}
    </div>
  )
}

function DrishtiPage({ role }: { role: 'victim' | 'helper' }) {
  const [dataMode, setDataMode] = useState<DataMode>('demonstration')
  const [activeSection, setActiveSection] = useState<SectionId>('situation')
  const [selectedTaluk, setSelectedTaluk] = useState('all')
  const [selectedGeography, setSelectedGeography] = useState('Udupi District')
  const [showBasemap, setShowBasemap] = useState(true)
  const [showDistrictBoundary, setShowDistrictBoundary] = useState(true)
  const [boundary, setBoundary] = useState<DistrictBoundary | null>(null)
  const [boundaryState, setBoundaryState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [boundaryError, setBoundaryError] = useState('')
  const [sourceStatuses, setSourceStatuses] = useState<DataSourceStatus[]>([])
  const [demoRainfall, setDemoRainfall] = useState<RainfallObservation[]>([])
  const [demoWeather, setDemoWeather] = useState<WeatherObservation | undefined>()
  const [historicalFloodDetail, setHistoricalFloodDetail] = useState('Historical flood dataset is unavailable.')
  const [timelineIndex, setTimelineIndex] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadData() {
      const [statuses, rainfall, weather, historical] = await Promise.all([
        drishtiProviders.live.getSourceStatuses(),
        drishtiProviders.demonstration.getRainfallTimeline(),
        drishtiProviders.demonstration.getCurrentWeather(),
        drishtiProviders.historical.getFloodRecords(),
      ])

      if (controller.signal.aborted) return
      setSourceStatuses(statuses)
      setDemoRainfall(rainfall.records)
      setDemoWeather(weather.records[0])
      setHistoricalFloodDetail(historical.detail)
      setTimelineIndex(Math.max(0, rainfall.records.length - 1))

      try {
        const response = await fetch('/data/drishti/udupi-district.geojson', { signal: controller.signal })
        if (!response.ok) throw new Error(`Boundary request returned HTTP ${response.status}`)
        const collection = await response.json() as BoundaryCollection
        const districtFeature = collection.features.find((feature) => feature.properties.shapeID === '76128533B4839184447445')
        if (!districtFeature) throw new Error('Verified Udupi district feature was not found in the boundary file.')
        setBoundary(districtFeature)
        setBoundaryState('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        setBoundaryError(error instanceof Error ? error.message : 'Boundary data could not be loaded.')
        setBoundaryState('error')
      }
    }

    void loadData()
    return () => controller.abort()
  }, [])

  const currentSection = sections.find((section) => section.id === activeSection) ?? sections[0]
  const selectedRainfall = demoRainfall[timelineIndex]
  const boundaryMapData = boundary as unknown as GeoJsonObject | null
  const mapExtent = useMemo(() => boundary ? boundaryExtent(boundary) : null, [boundary])
  const liveMode = dataMode === 'live'
  const historicalMode = dataMode === 'historical'

  function chooseTaluk(value: string) {
    setSelectedTaluk(value)
    const taluk = taluks.find((item) => item.id === value)
    setSelectedGeography(taluk ? `${taluk.name} Taluk` : 'Udupi District')
  }

  function renderSectionContent() {
    if (activeSection === 'situation') {
      return (
        <>
          {dataMode === 'demonstration' ? <ObservationValue rainfall={selectedRainfall} weather={demoWeather} /> : null}
          {liveMode && <UnavailablePanel title="Live observations unavailable" detail="No IMD, KSNDMC, or CWC observation feed is connected. Demonstration values are not substituted in this mode." />}
          {historicalMode && <UnavailablePanel title="Historical observations unavailable" detail="No verified station-level rainfall, weather, or river archive is connected." />}
          <div className="drishti-situation-list">
            <StatusIndicator tone={boundaryState === 'ready' ? 'ready' : 'warning'}>{boundaryState === 'ready' ? 'DISTRICT BOUNDARY LOADED' : 'BOUNDARY STATUS'}</StatusIndicator>
            <p>Udupi district reference outline · GeoBoundaries ADM2 · represented year 2021.</p>
            <StatusIndicator tone="warning">NO OFFICIAL WARNING FEED</StatusIndicator>
            <p>Warning status is unknown until an official provider is connected; no “all clear” is implied.</p>
          </div>
        </>
      )
    }

    if (activeSection === 'geospatial') {
      return (
        <div className="drishti-detail-list">
          <DetailRow label="District outline" value={boundaryState === 'ready' ? 'Available · ADM2 / 2021' : 'Loading or unavailable'} />
          <DetailRow label="Current taluk boundaries" value="Unavailable · not verified" />
          <DetailRow label="2018 subdistrict references" value="Not rendered · geometry conflicts with district boundary" />
          <DetailRow label="Hydrography" value="OpenStreetMap basemap only" />
          <DetailRow label="Selected geography" value={selectedGeography} />
        </div>
      )
    }

    if (activeSection === 'rainfall') {
      return (
        <>
          {dataMode === 'demonstration' ? <ObservationValue rainfall={selectedRainfall} weather={demoWeather} /> : null}
          {liveMode && <UnavailablePanel title="Official rainfall feed not connected" detail="IMD API access requires registration; KSNDMC’s public portal is reachable but its machine-readable feed was not verified." />}
          {historicalMode && <UnavailablePanel title="Historical rainfall unavailable" detail="A public rainfall atlas is linked from KSNDMC, but no station-level Udupi time series is connected to this interface." />}
        </>
      )
    }

    if (activeSection === 'river') {
      return <UnavailablePanel title="No verified gauge locations or readings" detail="CWC’s official Flood Forecast portal is reachable, but no public Udupi gauge feed or station coordinates were verified. No gauge markers are plotted." />
    }

    if (activeSection === 'risk') {
      return (
        <div className="drishti-risk-list">
          <RiskRow tone="neutral" label="Historical susceptibility" detail={historicalFloodDetail} />
          <RiskRow tone={dataMode === 'demonstration' ? 'warning' : 'neutral'} label="Current observations" detail={liveMode ? 'Unavailable; no live feed connected.' : historicalMode ? 'Historical mode selected; no station archive connected.' : 'Synthetic scenario values only; not measurements.'} />
          <RiskRow tone="critical" label="Official warnings" detail="Unknown. No official warning feed is connected; absence of data is not an all-clear." />
          <RiskRow tone="neutral" label="Preliminary indicators" detail="Not calculated. No flood prediction, risk score, or evacuation decision is generated." />
        </div>
      )
    }

    return (
      <>
        <UnavailablePanel title="Official alerts are not connected" detail="This interface does not monitor agency alerts in real time. Open the source portals directly to check current notices." />
        <div className="drishti-source-links">
          {sourceStatuses.map((status) => (
            <a key={status.source.id} href={status.source.url} target="_blank" rel="noreferrer">
              <span>{status.source.organization}</span><ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      </>
    )
  }

  return (
    <DashboardLayout role={role} title="DRISHTI" description="Environmental intelligence and flood monitoring" wide hidePageHeader>
      <div className="drishti-workspace">
        <header className="drishti-header">
          <div className="drishti-heading">
            <div className="drishti-heading-mark"><Waves size={19} aria-hidden="true" /></div>
            <div>
              <div className="drishti-heading-eyebrow">ENVIRONMENTAL INTELLIGENCE / FLOOD MONITORING</div>
              <h1>DRISHTI <span>Udupi District · Karnataka</span></h1>
            </div>
          </div>
          <div className="drishti-header-status">
            <StatusIndicator tone={dataMode === 'demonstration' ? 'warning' : dataMode === 'live' ? 'critical' : 'neutral'}>
              {dataMode === 'demonstration' ? 'DEMONSTRATION DATA' : liveMode ? 'LIVE FEEDS UNAVAILABLE' : 'HISTORICAL DATA UNAVAILABLE'}
            </StatusIndicator>
            <span className="drishti-header-updated"><Clock3 size={14} aria-hidden="true" /> Status registry loaded {formatTime(sourceStatuses[0]?.checkedAt)}</span>
          </div>
        </header>

        <div className="drishti-mode-strip" role="group" aria-label="Data mode">
          <span className="drishti-mode-label">DATA MODE</span>
          <ModeButton mode="demonstration" active={dataMode === 'demonstration'} onClick={setDataMode}>Demo scenario</ModeButton>
          <ModeButton mode="live" active={dataMode === 'live'} onClick={setDataMode}>Live sources</ModeButton>
          <ModeButton mode="historical" active={dataMode === 'historical'} onClick={setDataMode}>Historical</ModeButton>
          <span className="drishti-mode-explanation">
            {dataMode === 'demonstration' ? 'Synthetic values · not observations' : liveMode ? 'No data substituted' : 'No verified flood archive'}
          </span>
        </div>

        <Alert className="drishti-demo-banner" role="note">
          <Info size={16} aria-hidden="true" />
          <AlertTitle>{dataMode === 'demonstration' ? 'Demonstration scenario only' : liveMode ? 'Live data unavailable' : 'Historical archive unavailable'}</AlertTitle>
          <AlertDescription>
            {dataMode === 'demonstration'
              ? 'Displayed rainfall and weather values are synthetic, unlocated examples. They are not measurements, forecasts, or official warnings.'
              : liveMode
                ? 'Official portals are linked below, but no live feed is connected. Demonstration values are not substituted in this mode.'
                : 'No verified historical flood extent or station observation archive is connected.'}
          </AlertDescription>
        </Alert>

        <div className="drishti-grid">
          <aside className="drishti-control-panel" aria-label="Geography, sections, and map layers">
            <section className="drishti-control-section">
              <SectionHeading icon={MapPinned} title="Geography" index="01" />
              <Label className="drishti-field-label" htmlFor="district-select">District</Label>
              <Select value="udupi" onValueChange={() => setSelectedGeography('Udupi District')}>
                <SelectTrigger id="district-select" className="drishti-select"><SelectValue placeholder="Udupi District" /></SelectTrigger>
                <SelectContent position="popper"><SelectItem value="udupi">Udupi District</SelectItem></SelectContent>
              </Select>
              <Label className="drishti-field-label" htmlFor="taluk-select">Taluk</Label>
              <Select value={selectedTaluk} onValueChange={chooseTaluk}>
                <SelectTrigger id="taluk-select" className="drishti-select"><SelectValue placeholder="All taluks" /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">All taluks</SelectItem>
                  {taluks.map((taluk) => <SelectItem key={taluk.id} value={taluk.id}>{taluk.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label className="drishti-field-label" htmlFor="locality-search">Locality</Label>
              <Input
                id="locality-search"
                className="drishti-select"
                disabled
                placeholder="Locality dataset unavailable"
                aria-describedby="locality-status"
              />
              <p className="drishti-field-note" id="locality-status">No verified locality gazetteer or boundaries are connected.</p>
              {selectedTaluk !== 'all' && <p className="drishti-selected-note"><Navigation size={13} aria-hidden="true" /> {selectedGeography} selected · no current geometry</p>}
            </section>

            <section className="drishti-control-section">
              <SectionHeading icon={Activity} title="Sections" index="02" />
              <nav className="drishti-section-nav" aria-label="DRISHTI sections">
                {sections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      className={`drishti-section-link${activeSection === section.id ? ' is-active' : ''}`}
                      type="button"
                      aria-current={activeSection === section.id ? 'page' : undefined}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <Icon size={16} aria-hidden="true" /><span>{section.label}</span><ChevronRight size={14} aria-hidden="true" />
                    </button>
                  )
                })}
              </nav>
            </section>

            <section className="drishti-control-section drishti-layers">
              <SectionHeading icon={Layers3} title="Map layers" index="03" />
              <LayerToggle checked={showBasemap} label="OpenStreetMap basemap" description="Roads, mapped rivers and water bodies" onChange={setShowBasemap} />
              <LayerToggle checked={showDistrictBoundary} label="Udupi district boundary" description="GeoBoundaries ADM2 · 2021" onChange={setShowDistrictBoundary} />
              <LayerToggle checked={false} disabled label="Current taluk boundaries" description="No aligned, verified dataset" />
              <LayerToggle checked={false} disabled label="Rainfall stations" description="Locations not verified" />
              <LayerToggle checked={false} disabled label="River gauges" description="Locations not verified" />
              <LayerToggle checked={false} disabled label="Flood extent / susceptibility" description="No verified layer connected" />
              <p className="drishti-layer-footnote">Unavailable layers are not synthesized or shown on the map.</p>
            </section>
          </aside>

          <section className="drishti-map-panel" aria-label="Interactive district map">
            <div className="drishti-map-toolbar">
              <div><span className="drishti-map-live-dot" /><span>GEOSPATIAL VIEW</span><span className="drishti-map-separator">/</span><strong>{selectedGeography}</strong></div>
              <div className="drishti-map-toolbar-right"><span>BOUNDARY {boundaryState === 'ready' ? 'LOADED' : boundaryState.toUpperCase()}</span><ChevronDown size={14} aria-hidden="true" /></div>
            </div>
            <div className="drishti-map-canvas">
              {boundaryState === 'loading' && <div className="drishti-map-state"><Database size={21} /><strong>Loading verified boundary</strong><span>Retrieving the local district reference file.</span></div>}
              {boundaryState === 'error' && <div className="drishti-map-state drishti-map-error"><AlertTriangle size={21} /><strong>District geometry unavailable</strong><span>{boundaryError}</span></div>}
              {boundaryState === 'ready' && boundary && mapExtent && (
                <>
                  <MapContainer center={mapExtent.center} zoom={8} minZoom={7} maxZoom={15} scrollWheelZoom zoomControl={false} className="drishti-leaflet-map">
                    <FitDistrict bounds={mapExtent.bounds} />
                    {showBasemap && <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />}
                    {showDistrictBoundary && boundaryMapData && (
                      <GeoJSON
                        key={boundary.properties.shapeID}
                        data={boundaryMapData}
                        style={{ color: '#83B96B', weight: 2.5, fillColor: '#83B96B', fillOpacity: 0.06 }}
                        eventHandlers={{ click: () => { setSelectedTaluk('all'); setSelectedGeography('Udupi District') } }}
                      />
                    )}
                    <ZoomControl position="bottomright" />
                    <ScaleControl imperial={false} position="bottomleft" />
                  </MapContainer>
                  <div className="drishti-map-key" aria-label="Map legend">
                    <span><i className="map-key-boundary" />Verified district outline</span>
                    <span><i className="map-key-basemap" />OSM mapped hydrography</span>
                  </div>
                  <div className="drishti-map-source">Boundary: GeoBoundaries / LGDirectory · 2021</div>
                </>
              )}
            </div>
            <div className="drishti-map-footer">
              <span>{selectedGeography}</span>
              <span>Click the district outline to reset selection</span>
              <StatusIndicator tone={boundaryState === 'ready' ? 'ready' : 'warning'}>{boundaryState === 'ready' ? 'REFERENCE GEOGRAPHY' : 'GEOGRAPHY STATUS'}</StatusIndicator>
            </div>
          </section>

          <aside className="drishti-situation-panel" aria-live="polite">
            <div className="drishti-situation-heading">
              <div><p className="drishti-panel-eyebrow">SITUATION / {String(sections.findIndex((section) => section.id === activeSection) + 1).padStart(2, '0')}</p><h2>{sectionTitles[activeSection]}</h2></div>
              <StatusIndicator tone={dataMode === 'demonstration' ? 'warning' : 'neutral'}>{dataMode === 'demonstration' ? 'DEMO' : liveMode ? 'NO FEED' : 'NO ARCHIVE'}</StatusIndicator>
            </div>
            <p className="drishti-section-description">{currentSection.description}</p>
            <div className="drishti-panel-content">{renderSectionContent()}</div>

            <section className="drishti-source-status" aria-labelledby="source-status-title">
              <div className="drishti-source-status-heading"><h3 id="source-status-title">Source status</h3><span>{sourceStatuses.length} AGENCIES</span></div>
              {sourceStatuses.map((status) => (
                <div className="drishti-source-row" key={status.source.id}>
                  <div className="drishti-source-name"><span className={`source-state-dot source-state-${status.state}`} /><a href={status.source.url} target="_blank" rel="noreferrer">{status.source.organization}<ExternalLink size={11} aria-hidden="true" /></a></div>
                  <p>{status.detail}</p>
                  <time dateTime={status.checkedAt}>Status registry loaded {formatTime(status.checkedAt)}</time>
                </div>
              ))}
            </section>
          </aside>

          <section className="drishti-timeline" aria-label="Observation time navigation">
            <div className="drishti-timeline-label"><Clock3 size={16} aria-hidden="true" /><div><strong>{dataMode === 'demonstration' ? 'DEMONSTRATION SCENARIO TIMELINE' : 'TIME NAVIGATION'}</strong><span>{dataMode === 'demonstration' ? 'Synthetic six-hour samples · not historical observations' : 'No observations available in this data mode'}</span></div></div>
            <div className="drishti-timeline-control">
              <Button type="button" size="icon-sm" variant="outline" aria-label="Previous time step" disabled={dataMode !== 'demonstration' || timelineIndex === 0} onClick={() => setTimelineIndex((index) => Math.max(0, index - 1))}><ChevronLeft size={16} /></Button>
              <input
                type="range"
                min={0}
                max={Math.max(0, demoRainfall.length - 1)}
                step={1}
                value={Math.min(timelineIndex, Math.max(0, demoRainfall.length - 1))}
                disabled={dataMode !== 'demonstration' || demoRainfall.length < 2}
                aria-label="Select demonstration timeline time"
                onChange={(event) => setTimelineIndex(Number(event.target.value))}
              />
              <Button type="button" size="icon-sm" variant="outline" aria-label="Next time step" disabled={dataMode !== 'demonstration' || timelineIndex >= demoRainfall.length - 1} onClick={() => setTimelineIndex((index) => Math.min(demoRainfall.length - 1, index + 1))}><ChevronRight size={16} /></Button>
            </div>
            <div className="drishti-timeline-time">{dataMode === 'demonstration' ? formatTime(selectedRainfall?.observedAt) : 'No observation time'}</div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}

function SectionHeading({ icon: Icon, title, index }: { icon: typeof Activity; title: string; index: string }) {
  return <div className="drishti-control-heading"><Icon size={15} aria-hidden="true" /><h2>{title}</h2><span>{index}</span></div>
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="drishti-detail-row"><span>{label}</span><strong>{value}</strong></div>
}

function UnavailablePanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="drishti-unavailable">
      <Info size={16} aria-hidden="true" />
      <div><strong>{title}</strong><p>{detail}</p></div>
    </div>
  )
}

function RiskRow({ tone, label, detail }: { tone: 'neutral' | 'warning' | 'critical'; label: string; detail: string }) {
  const Icon = tone === 'critical' ? AlertTriangle : tone === 'warning' ? ArrowUp : ArrowDown
  return <div className={`drishti-risk-row risk-${tone}`}><Icon size={15} aria-hidden="true" /><div><strong>{label}</strong><p>{detail}</p></div></div>
}

export default DrishtiPage