import type {
  DataSourceRef,
  DataSourceStatus,
  DemonstrationDataProvider,
  District,
  DrishtiProviders,
  HistoricalDataProvider,
  LiveDataProvider,
  Observation,
  ProviderResult,
  RainfallObservation,
  Taluk,
  WeatherObservation,
} from '../types'

export const district: District = {
  id: 'udupi-karnataka-india',
  name: 'Udupi',
  state: 'Karnataka',
  country: 'India',
  boundaryDataset: 'GeoBoundaries gbOpen IND ADM2, sourced from LGDirectory',
  boundaryYear: 2021,
  boundaryLicense: 'ODbL-1.0',
}

export const taluks: Taluk[] = [
  { id: 'udupi', name: 'Udupi', districtId: district.id, sourceLabel: 'Udupi District Tehsil page (2018)', boundaryState: 'unavailable' },
  { id: 'kapu', name: 'Kapu', districtId: district.id, sourceLabel: 'Udupi District Tehsil page (2018)', boundaryState: 'unavailable' },
  { id: 'brahmavara', name: 'Brahmavara', districtId: district.id, sourceLabel: 'Listed as Bhramavara by Udupi District (2018)', boundaryState: 'unavailable' },
  { id: 'kundapura', name: 'Kundapura', districtId: district.id, sourceLabel: 'Udupi District Tehsil page (2018)', boundaryState: 'unavailable' },
  { id: 'byndoor', name: 'Byndoor', districtId: district.id, sourceLabel: 'Udupi District Tehsil page (2018)', boundaryState: 'unavailable' },
  { id: 'karkala', name: 'Karkala', districtId: district.id, sourceLabel: 'Udupi District Tehsil page (2018)', boundaryState: 'unavailable' },
  { id: 'hebri', name: 'Hebri', districtId: district.id, sourceLabel: 'Udupi District Tehsil page (2018)', boundaryState: 'unavailable' },
]

export const sourceCatalog = {
  imd: {
    id: 'imd-api',
    label: 'IMD API Management',
    organization: 'India Meteorological Department',
    mode: 'live',
    url: 'https://api.imd.gov.in/',
  },
  ksndmc: {
    id: 'ksndmc-weather',
    label: 'Weather monitoring',
    organization: 'Karnataka State Natural Disaster Monitoring Centre',
    mode: 'live',
    url: 'https://ksndmc.org/kn/Activities/Weather',
  },
  cwc: {
    id: 'cwc-flood-forecast',
    label: 'Flood Forecast portal',
    organization: 'Central Water Commission, Government of India',
    mode: 'live',
    url: 'https://ffs.india-water.gov.in/',
  },
  ddma: {
    id: 'udupi-ddma',
    label: 'District administration',
    organization: 'Udupi District Administration',
    mode: 'live',
    url: 'https://udupi.nic.in/en/',
  },
  geoBoundaries: {
    id: 'geoboundaries-ind-adm2',
    label: 'Udupi district boundary reference',
    organization: 'GeoBoundaries / Pathways Data / LGDirectory',
    mode: 'historical',
    url: 'https://www.geoboundaries.org/api/current/gbOpen/IND/ADM2/',
  },
  osm: {
    id: 'openstreetmap-basemap',
    label: 'OpenStreetMap basemap',
    organization: 'OpenStreetMap contributors',
    mode: 'live',
    url: 'https://www.openstreetmap.org/copyright',
  },
  demonstration: {
    id: 'drishti-demo-scenario',
    label: 'Demonstration scenario',
    organization: 'ABHEDYA prototype',
    mode: 'demonstration',
  },
} satisfies Record<string, DataSourceRef>

function unavailableResult<TValue>(
  mode: 'live' | 'historical',
  source: DataSourceRef,
  detail: string,
): ProviderResult<TValue> {
  return {
    mode,
    state: 'unavailable',
    records: [],
    source,
    retrievedAt: new Date().toISOString(),
    detail,
  }
}

const liveProvider: LiveDataProvider = {
  async getSourceStatuses(): Promise<DataSourceStatus[]> {
    const checkedAt = new Date().toISOString()
    return [
      {
        source: sourceCatalog.imd,
        state: 'credential-required',
        detail: 'Official API portal is reachable. API access requires registered credentials; none are configured in this frontend.',
        checkedAt,
      },
      {
        source: sourceCatalog.ksndmc,
        state: 'portal-only',
        detail: 'Official weather pages are reachable. A public machine-readable feed and district-station coverage were not verified.',
        checkedAt,
      },
      {
        source: sourceCatalog.cwc,
        state: 'portal-only',
        detail: 'Official flood-forecast portal is reachable. No documented public API is integrated.',
        checkedAt,
      },
      {
        source: sourceCatalog.ddma,
        state: 'portal-only',
        detail: 'District administration pages are reachable. No live alert or observation feed was found.',
        checkedAt,
      },
    ]
  },

  async getCurrentObservations() {
    return unavailableResult(
      'live',
      sourceCatalog.imd,
      'No official observation API is connected. Demonstration values are never substituted into live mode.',
    )
  },

  async getOfficialAlerts() {
    return unavailableResult(
      'live',
      sourceCatalog.ddma,
      'No official alert feed is connected. Check the linked agency portals for current notices.',
    )
  },

  async getForecasts() {
    return unavailableResult(
      'live',
      sourceCatalog.imd,
      'No official forecast feed is connected. No forecast or evacuation decision is generated by ABHEDYA.',
    )
  },
}

const historicalProvider: HistoricalDataProvider = {
  async getFloodRecords() {
    return unavailableResult(
      'historical',
      sourceCatalog.ddma,
      'No verified historical flood extent or event dataset for Udupi is connected.',
    )
  },

  async getHistoricalObservations() {
    return unavailableResult(
      'historical',
      sourceCatalog.ksndmc,
      'No station-level historical rainfall, weather, or river observation archive is connected.',
    )
  },
}

const demonstrationProvider: DemonstrationDataProvider = {
  async getRainfallTimeline(): Promise<ProviderResult<RainfallObservation>> {
    const retrievedAt = new Date().toISOString()
    const sampleValues = [4.2, 8.6, 12.1, 7.4, 18.3, 11.6]
    const records = sampleValues.map((value, index): RainfallObservation => ({
      id: `demo-rainfall-${index + 1}`,
      value,
      observedAt: new Date(Date.now() - (sampleValues.length - index - 1) * 6 * 60 * 60 * 1000).toISOString(),
      retrievedAt,
      units: 'mm / 6 h',
      category: 'rainfall',
      source: sourceCatalog.demonstration,
      locationId: null,
      locationLabel: 'Unlocated district-level scenario value; not a station measurement.',
      coordinates: null,
    }))

    return {
      mode: 'demonstration',
      state: 'available',
      records,
      source: sourceCatalog.demonstration,
      retrievedAt,
      detail: 'Synthetic scenario values for interface demonstration only. They are not observations or a forecast.',
    }
  },

  async getCurrentWeather(): Promise<ProviderResult<WeatherObservation>> {
    const retrievedAt = new Date().toISOString()
    const observation: WeatherObservation = {
      id: 'demo-weather-1',
      value: { temperature: 27.1, relativeHumidity: 78, windSpeed: 9.4 },
      observedAt: retrievedAt,
      retrievedAt,
      units: 'temperature: °C; humidity: %; wind: km/h',
      category: 'weather',
      source: sourceCatalog.demonstration,
      locationId: null,
      locationLabel: 'Unlocated district-level scenario value; not a station measurement.',
      coordinates: null,
    }

    return {
      mode: 'demonstration',
      state: 'available',
      records: [observation],
      source: sourceCatalog.demonstration,
      retrievedAt,
      detail: 'Synthetic scenario values for interface demonstration only. They are not observations or a forecast.',
    }
  },
}

export const drishtiProviders: DrishtiProviders = {
  live: liveProvider,
  historical: historicalProvider,
  demonstration: demonstrationProvider,
}

export type EnvironmentalObservation = Observation<number | { temperature: number; relativeHumidity: number; windSpeed: number }>