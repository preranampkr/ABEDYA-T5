import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { enableLocalPreview } from '../lib/localPreview'
import type { AuthMode, WorkspaceRole } from '../types/domain'

interface AuthPageProps {
  role: WorkspaceRole
  mode: AuthMode
}

function AuthPage({ role, mode }: AuthPageProps) {
  const isHelper = role === 'helper'
  const isSignup = mode === 'signup'
  const isPasswordReset = mode === 'password-reset'
  const isUpdatePassword = mode === 'update-password'
  const roleLabel = isHelper ? 'Helper' : 'Victim'
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!isSupabaseConfigured || !supabase) {
      setError('Authentication is not configured. Add the Supabase URL and public key to the local environment.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    setBusy(true)
    try {
      if (isPasswordReset) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/update-password`,
        })
        if (resetError) throw resetError
        setMessage('If an account exists for that email, a password reset link has been sent.')
        return
      }

      if (isUpdatePassword) {
        const password = String(formData.get('password') ?? '')
        if (password !== formData.get('confirm-password')) {
          setError('Passwords do not match.')
          return
        }
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError
        setMessage('Password updated. Sign in with your new password.')
        navigate(`/${role}/login`, { replace: true })
        return
      }

      const password = String(formData.get('password') ?? '')
      if (isSignup && password !== formData.get('confirm-password')) {
        setError('Passwords do not match. Check both fields and try again.')
        return
      }

      if (isSignup) {
        const metadata: Record<string, string> = {
          display_name: String(formData.get('display-name') ?? '').trim(),
          phone: String(formData.get('phone') ?? '').trim(),
        }
        if (isHelper) {
          metadata.requested_role = 'helper'
          metadata.organization = String(formData.get('organization') ?? '').trim()
          metadata.application_details = String(formData.get('application-details') ?? '').trim()
        }
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: metadata },
        })
        if (signupError) throw signupError
        if (!data.session) {
          setMessage(isHelper
            ? 'Check your email to confirm the account. Your helper application will be reviewed after confirmation.'
            : 'Check your email to confirm your account before signing in.')
          return
        }
        navigate(isHelper ? '/helper/dashboard' : '/victim/dashboard', { replace: true })
        return
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) throw loginError
      navigate(destination || (isHelper ? '/helper/dashboard' : '/victim/dashboard'), { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const title = isPasswordReset
    ? 'Reset your password'
    : isUpdatePassword ? 'Choose a new password'
      : isSignup ? `Register as ${roleLabel}` : `${roleLabel} sign in`
  const description = isSignup
    ? isHelper ? 'Create an account and submit a helper access application.' : 'Create your ABHEDYA victim account.'
    : isPasswordReset ? 'We will email a secure password reset link if the account exists.'
      : isUpdatePassword ? 'Set a new password for your ABHEDYA account.' : 'Sign in to your ABHEDYA workspace.'

  return (
    <div className="public-page auth-page">
      <header className="site-header content-width">
        <Brand />
        <Link className="text-action" to="/roles"><ArrowLeft size={15} aria-hidden="true" /> Change role</Link>
      </header>
      <main className="auth-main content-width">
        <section className="auth-panel">
          <div className="auth-panel-topline"><ShieldCheck size={17} aria-hidden="true" /><span>{roleLabel.toUpperCase()} ACCESS</span></div>
          <PageHeader eyebrow={isSignup ? 'PROFILE SETUP' : 'ACCOUNT ACCESS'} title={title} description={description} />
          {!isSupabaseConfigured && <p className="form-message" role="status">Supabase is not configured. Authentication is unavailable in this environment.</p>}
          <form className="auth-form" onSubmit={handleSubmit}>
            {(isSignup || isPasswordReset || mode === 'login') && (
              <FormField id="email" label="Email" name="email" type="email" autoComplete={isSignup ? 'email' : 'username'} required />
            )}
            {isSignup && <FormField id="display-name" label="Full name" name="display-name" autoComplete="name" required />}
            {isSignup && <FormField id="phone" label="Phone number" name="phone" type="tel" autoComplete="tel" />}
            {isSignup && isHelper && (
              <>
                <FormField id="organization" label="Organization or response group" name="organization" autoComplete="organization" required />
                <label className="form-field" htmlFor="application-details">
                  <span className="field-label">Why are you applying as a helper?</span>
                  <textarea className="text-input" id="application-details" name="application-details" rows={3} required />
                </label>
              </>
            )}
            {!isPasswordReset && (
              <div className="form-field">
                <Label className="field-label" htmlFor="password">{isUpdatePassword ? 'New password' : 'Password'}</Label>
                <div className="password-input-wrap">
                  <Input
                    className="text-input"
                    id="password"
                    name="password"
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete={isSignup || isUpdatePassword ? 'new-password' : 'current-password'}
                    minLength={8}
                    required
                  />
                  <Button
                    className="password-toggle"
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  >
                    {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </Button>
                </div>
                {(isSignup || isUpdatePassword) && <p className="field-hint">Use at least 8 characters.</p>}
              </div>
            )}
            {(isSignup || isUpdatePassword) && (
              <FormField
                id="confirm-password"
                label="Confirm password"
                name="confirm-password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
              />
            )}
            <Button className="button button-primary auth-submit" type="submit" disabled={busy || !isSupabaseConfigured}>
              {busy ? 'Please wait…' : isSignup ? 'Create account' : isPasswordReset ? 'Send reset link' : isUpdatePassword ? 'Update password' : 'Sign in'}
            </Button>
            {error && <p className="form-message auth-error" role="alert">{error}</p>}
            {message && <p className="form-message" role="status" aria-live="polite">{message}</p>}
          </form>
          {!isSupabaseConfigured && import.meta.env.DEV && (
            <div className="auth-dev-actions">
              <Button asChild className="button button-outline button-small" variant="outline" size="sm">
                <Link to={`/${role}/dashboard`} onClick={enableLocalPreview}>Open local prototype preview</Link>
              </Button>
              <p className="field-hint">Local-only preview. Authentication and database actions are not enabled.</p>
            </div>
          )}
          {mode === 'login' && <p className="auth-switch"><Link to={`/${role}/password-reset`}>Forgot password?</Link></p>}
          {(mode === 'login' || isSignup) && (
            <p className="auth-switch">
              {isSignup ? 'Already registered?' : 'New to ABHEDYA?'}{' '}
              <Link to={`/${role}/${isSignup ? 'login' : 'signup'}`}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
            </p>
          )}
          <Link className="auth-back" to="/roles"><ArrowLeft size={14} aria-hidden="true" /> Return to role selection</Link>
        </section>
        <aside className="auth-aside">
          <p className="eyebrow">ABHEDYA / {roleLabel.toUpperCase()}</p>
          <p className="auth-aside-tagline">Before.<br />During.<br />Beyond.</p>
          <p>{isHelper ? 'Helper workspace access requires administrator approval.' : 'Your reports are available only to you and authorized response helpers.'}</p>
          <Link className="text-action" to="/">Go to emergency SOS <ArrowLeft size={14} aria-hidden="true" /></Link>
        </aside>
      </main>
    </div>
  )
}

export default AuthPage