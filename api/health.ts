import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getServerConfig, methodNotAllowed, sendJson } from './_lib/server.ts'

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const config = getServerConfig()
  const statusPayload: {
    ok: boolean
    service: string
    timestamp: string
    config: {
      supabaseUrlConfigured: boolean
      supabaseAnonKeyConfigured: boolean
      serviceRoleConfigured: boolean
    }
    database: {
      connected: boolean
      latencyMs?: number
      error?: string
    }
  } = {
    ok: true,
    service: 'abhedya-vercel-backend',
    timestamp: new Date().toISOString(),
    config: {
      supabaseUrlConfigured: Boolean(config.supabaseUrl),
      supabaseAnonKeyConfigured: Boolean(config.anonKey),
      serviceRoleConfigured: Boolean(config.serviceRoleKey),
    },
    database: {
      connected: false,
    },
  }

  const queryKey = config.serviceRoleKey || config.anonKey
  if (!config.supabaseUrl || !queryKey) {
    statusPayload.ok = false
    statusPayload.database.error = 'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.'
    sendJson(res, 200, statusPayload)
    return
  }

  const startedAt = Date.now()
  try {
    const client = createClient(config.supabaseUrl, queryKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.from('sanket_reports').select('id').limit(1)
    const latencyMs = Date.now() - startedAt
    if (error && !error.message.toLowerCase().includes('permission denied')) {
      statusPayload.ok = false
      statusPayload.database = { connected: false, latencyMs, error: error.message }
    } else {
      statusPayload.database = { connected: true, latencyMs }
    }
  } catch (error) {
    statusPayload.ok = false
    statusPayload.database = {
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Database connectivity probe failed.',
    }
  }

  sendJson(res, 200, statusPayload)
}

