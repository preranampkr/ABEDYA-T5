export type DataMode = 'live' | 'historical' | 'demonstration'

export type ObservationCategory =
  | 'rainfall'
  | 'weather'
  | 'river-level'
  | 'forecast'
  | 'official-alert'
  | 'historical-flood'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface DataSourceRef {
  id: string
  label: string
  organization: string
  mode: DataMode
  url?: string
}

export interface DataSourceStatus {
  source: DataSourceRef
  state: 'credential-required' | 'portal-only' | 'unavailable'
  detail: string
  checkedAt: string
}

export interface Observation<TValue> {
  id: string
  value: TValue
  observedAt: string
  retrievedAt: string
  units: string
  category: ObservationCategory
  source: DataSourceRef
  locationId: string | null
  locationLabel: string
  coordinates: Coordinate | null
}

export type RainfallObservation = Observation<number> & {
  category: 'rainfall'
}

export interface WeatherReading {
  temperature: number
  relativeHumidity: number
  windSpeed: number
}

export type WeatherObservation = Observation<WeatherReading> & {
  category: 'weather'
}

export type RiverObservation = Observation<number> & {
  category: 'river-level'
}

export interface Forecast {
  id: string
  issuedAt: string
  retrievedAt: string
  validFrom: string
  validTo: string
  summary: string
  value: number | null
  units: string
  category: 'forecast'
  source: DataSourceRef
}

export interface OfficialAlert {
  id: string
  issuedAt: string
  retrievedAt: string
  title: string
  description: string
  severity: 'advisory' | 'watch' | 'warning' | 'emergency'
  category: 'official-alert'
  source: DataSourceRef
}

export interface HistoricalFloodRecord {
  id: string
  title: string
  startAt: string
  endAt: string | null
  description: string
  category: 'historical-flood'
  source: DataSourceRef
  retrievedAt: string
}

export interface GeographicFeature<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: 'Feature'
  id?: string | number
  properties: TProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface GeographicFeatureCollection<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: 'FeatureCollection'
  features: GeographicFeature<TProperties>[]
}

export interface District {
  id: string
  name: string
  state: string
  country: string
  boundaryDataset: string
  boundaryYear: number
  boundaryLicense: string
}

export type TalukBoundaryState = 'current-verified' | 'historical-reference' | 'unavailable'

export interface Taluk {
  id: string
  name: string
  districtId: string
  sourceLabel: string
  boundaryState: TalukBoundaryState
}

export interface MonitoringStation {
  id: string
  name: string
  agency: string
  stationType: 'rainfall' | 'weather' | 'river-gauge'
  coordinates: Coordinate | null
  source: DataSourceRef
}

export interface ProviderResult<TValue> {
  mode: DataMode
  state: 'available' | 'unavailable'
  records: TValue[]
  source: DataSourceRef
  retrievedAt: string
  detail: string
}

export interface LiveDataProvider {
  getSourceStatuses(): Promise<DataSourceStatus[]>
  getCurrentObservations(): Promise<ProviderResult<Observation<number | WeatherReading>[]>>
  getOfficialAlerts(): Promise<ProviderResult<OfficialAlert>>
  getForecasts(): Promise<ProviderResult<Forecast>>
}

export interface HistoricalDataProvider {
  getFloodRecords(): Promise<ProviderResult<HistoricalFloodRecord>>
  getHistoricalObservations(): Promise<ProviderResult<Observation<number | WeatherReading>>>
}

export interface DemonstrationDataProvider {
  getRainfallTimeline(): Promise<ProviderResult<RainfallObservation>>
  getCurrentWeather(): Promise<ProviderResult<WeatherObservation>>
}

export interface DrishtiProviders {
  live: LiveDataProvider
  historical: HistoricalDataProvider
  demonstration: DemonstrationDataProvider
}