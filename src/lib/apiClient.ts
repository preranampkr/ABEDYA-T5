import { isLocalPreviewEnabled } from './localPreview.ts'
import { isSupabaseConfigured, supabase } from './supabase.ts'

export function isBackendConnected(): boolean {
  return isSupabaseConfigured && !isLocalPreviewEnabled()
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestInit = {},
): Promise<TResponse> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { error: text }
    }
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Request to ${path} failed with HTTP ${response.status}`
    throw new Error(message)
  }

  return parsed as TResponse
}

