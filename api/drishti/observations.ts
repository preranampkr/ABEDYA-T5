import type { IncomingMessage, ServerResponse } from 'node:http'
import { methodNotAllowed, sendJson } from '../_lib/server.ts'

interface OpenMeteoPayload {
  latitude?: number
  longitude?: number
  current?: {
    time?: string
    temperature_2m?: number
    relative_humidity_2m?: number
    wind_speed_10m?: number
    precipitation?: number
  }
  hourly?: {
    time?: string[]
    precipitation?: number[]
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=13.3409&longitude=74.7421&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&hourly=precipitation&past_hours=24&forecast_hours=0&timezone=Asia%2FKolkata'
    const upstream = await fetch(url, { signal: controller.signal })
    if (!upstream.ok) {
      throw new Error(`Open-Meteo returned HTTP ${upstream.status}`)
    }

    const payload = (await upstream.json()) as OpenMeteoPayload
    const retrievedAt = new Date().toISOString()

    sendJson(res, 200, {
      mode: 'live',
      state: 'available',
      retrievedAt,
      provider: {
        id: 'open-meteo-udupi',
        label: 'Open-Meteo Live Weather Feed (via Vercel /api/drishti/observations)',
        organization: 'Open-Meteo API',
        url: 'https://open-meteo.com/',
      },
      current: {
        observedAt: payload.current?.time ?? retrievedAt,
        temperature: payload.current?.temperature_2m ?? null,
        relativeHumidity: payload.current?.relative_humidity_2m ?? null,
        windSpeed: payload.current?.wind_speed_10m ?? null,
        precipitationMm: payload.current?.precipitation ?? 0,
      },
      hourlyPrecipitation: (payload.hourly?.time ?? []).map((time, idx) => ({
        time,
        precipitationMm: payload.hourly?.precipitation?.[idx] ?? 0,
      })),
    })
  } catch (error) {
    sendJson(res, 502, {
      mode: 'live',
      state: 'unavailable',
      retrievedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unable to fetch live observations.',
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

