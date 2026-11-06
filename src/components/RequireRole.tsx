import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { supabase } from '../lib/supabase'
import { isLocalPreviewEnabled } from '../lib/localPreview'
import type { UserRole } from '../types/domain'

function AccessMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="public-page auth-page">
      <section className="auth-panel access-message">
        <p className="eyebrow">ABHEDYA / ACCOUNT ACCESS</p>
        <h1>{title}</h1>
        <div className="form-message">{children}</div>
        <Link className="text-action" to="/">Return to ABHEDYA</Link>
      </section>
    </main>
  )
}

function CompleteProfile({ onComplete }: { onComplete: () => Promise<void> }) {
  const { profile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !profile) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('user_profiles')
      .update({ display_name: displayName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id)
    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }
    try {
      await onComplete()
    } catch (refreshError) {
      setMessage(refreshError instanceof Error ? refreshError.message : 'Profile could not be refreshed.')
    }
    setSaving(false)
  }

  return (
    <main className="public-page auth-page">
      <section className="auth-panel access-message">
        <p className="eyebrow">PROFILE SETUP</p>
        <h1>Complete your profile</h1>
        <p>Provide your name before entering the workspace.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field">
            <span className="field-label">Full name</span>
            <input className="text-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label className="form-field">
            <span className="field-label">Phone number</span>
            <input className="text-input" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          {message && <p className="form-message" role="alert">{message}</p>}
        </form>
      </section>
    </main>
  )
}

export default function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const location = useLocation()
  const auth = useAuth()

  if (auth.loading) return <div className="drishti-loading" role="status">Restoring your ABHEDYA session…</div>
  if (!auth.session) {
    if (!auth.configured && role !== 'admin' && isLocalPreviewEnabled()) return children
    const loginRole = role === 'admin' ? 'victim' : role
    return <Navigate to={`/${loginRole}/login`} replace state={{ from: location }} />
  }
  if (!auth.configured) {
    return <AccessMessage title="Authentication is not configured">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the local environment, then reload.</AccessMessage>
  }
  if (auth.error) {
    return <AccessMessage title="Account could not be loaded">{auth.error}</AccessMessage>
  }
  if (!auth.profile) {
    return <AccessMessage title="Profile unavailable">Your authenticated account has no ABHEDYA profile. Contact an administrator.</AccessMessage>
  }
  if (auth.profile.account_status !== 'active') {
    return <AccessMessage title="Account access unavailable">Your account is {auth.profile.account_status}. Contact an administrator for help.</AccessMessage>
  }
  if (!auth.profile.display_name?.trim()) {
    return <CompleteProfile onComplete={async () => { await auth.refreshProfile() }} />
  }
  if (role === 'helper' && auth.profile.role !== 'helper') {
    if (auth.helperApplicationStatus === 'pending') {
      return <AccessMessage title="Helper application pending">Your account remains in the victim workspace until an administrator approves your helper application.</AccessMessage>
    }
    if (auth.helperApplicationStatus === 'rejected') {
      return <AccessMessage title="Helper application not approved">Your application was not approved. You can continue to use the victim workspace.</AccessMessage>
    }
  }
  if (auth.profile.role !== role) {
    const destination = auth.profile.role === 'admin'
      ? '/admin/users'
      : auth.profile.role === 'helper' ? '/helper/dashboard' : '/victim/dashboard'
    return <Navigate to={destination} replace />
  }
  return children
}