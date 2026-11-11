import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type ActiveUserRole = 'victim' | 'helper' | 'admin'

export interface AuthenticatedContext {
  userId: string
  role: ActiveUserRole
  displayName: string
  db: SupabaseClient
  adminDb: SupabaseClient
}

export function getServerConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    configured: Boolean(supabaseUrl && (serviceRoleKey || anonKey)),
  }
}

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function methodNotAllowed(res: ServerResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '))
  sendJson(res, 405, { error: `Method not allowed. Allowed: ${allowed.join(', ')}` })
}

export async function readJsonBody<TBody extends Record<string, unknown>>(req: IncomingMessage): Promise<TBody> {
  const reqWithBody = req as IncomingMessage & { body?: unknown }
  if (reqWithBody.body && typeof reqWithBody.body === 'object' && !Array.isArray(reqWithBody.body)) {
    return reqWithBody.body as TBody
  }
  if (typeof reqWithBody.body === 'string' && reqWithBody.body.trim()) {
    return JSON.parse(reqWithBody.body) as TBody
  }

  const chunks: Buffer[] = []
  let totalBytes = 0
  const maxBytes = 64 * 1024

  for await (const chunk of req) {
    const bufferChunk = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer)
    totalBytes += bufferChunk.length
    if (totalBytes > maxBytes) {
      throw new Error('Request payload exceeds 64 KB limit.')
    }
    chunks.push(bufferChunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {} as TBody
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.')
  }
  return parsed as TBody
}

export function getQueryUrl(req: IncomingMessage): URL {
  const host = req.headers.host || 'localhost'
  return new URL(req.url || '/', `http://${host}`)
}

export async function authenticateRequest(
  req: IncomingMessage,
  res: ServerResponse,
  allowedRoles?: ActiveUserRole[],
): Promise<AuthenticatedContext | null> {
  const config = getServerConfig()
  if (!config.configured) {
    sendJson(res, 503, { error: 'Supabase database environment variables are not configured.' })
    return null
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    sendJson(res, 401, { error: 'Authentication bearer token is required.' })
    return null
  }

  const authKey = config.anonKey || config.serviceRoleKey
  const userClient = createClient(config.supabaseUrl, authKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) {
    sendJson(res, 401, { error: 'Invalid or expired authentication token.' })
    return null
  }

  const adminClient = config.serviceRoleKey
    ? createClient(config.supabaseUrl, config.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : userClient

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('id, role, account_status, display_name')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    sendJson(res, 403, { error: 'User profile could not be verified.' })
    return null
  }

  if (profile.account_status !== 'active') {
    sendJson(res, 403, { error: `Account status is "${String(profile.account_status)}". Active approval required.` })
    return null
  }

  const role = profile.role as ActiveUserRole
  if (allowedRoles && !allowedRoles.includes(role)) {
    sendJson(res, 403, { error: `Insufficient permissions for role "${role}".` })
    return null
  }

  return {
    userId: userData.user.id,
    role,
    displayName: (typeof profile.display_name === 'string' && profile.display_name.trim()) || userData.user.email || 'Operator',
    db: userClient,
    adminDb: adminClient,
  }
}
