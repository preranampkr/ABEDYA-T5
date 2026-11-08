import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../features/auth/AuthContext'
import type { AuthMode, UserRole } from '../types/domain'

interface AuthPageProps {
  role: UserRole
  mode: AuthMode
}

function AuthPage({ role, mode }: AuthPageProps) {
  const isHelper = role === 'helper'
  const isAdmin = role === 'admin'
  const isSignup = mode === 'signup'
  const roleLabel = isAdmin ? 'Admin' : isHelper ? 'Helper' : 'Citizen'

  const [passwordVisible, setPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { signIn, signUp, isConfigured, devSimulateSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromLocation = (location.state as { from?: { pathname: string } })?.from?.pathname

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = (formData.get('identity') as string)?.trim()
    const password = formData.get('password') as string
    const fullName = (formData.get('full-name') as string)?.trim() || 'Citizen User'
    const organization = (formData.get('organization') as string)?.trim()

    if (isSignup && password !== formData.get('confirm-password')) {
      setErrorMessage('Passwords do not match. Check both fields and try again.')
      setIsSubmitting(false)
      return
    }

    if (!isConfigured) {
      // Supabase is not yet configured with live env keys.
      // Explain clearly and offer simulated session testing
      setErrorMessage(
        'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to enable live authentication.'
      )
      setIsSubmitting(false)
      return
    }

    try {
      if (isSignup) {
        const res = await signUp({
          email,
          password,
          fullName,
          role,
          organization,
        })

        if (!res.success) {
          setErrorMessage(res.error || 'Registration failed. Please try again.')
          setIsSubmitting(false)
          return
        }

        if (role === 'helper') {
          navigate('/helper/pending-approval')
        } else {
          navigate(fromLocation || '/victim/dashboard')
        }
      } else {
        const res = await signIn(email, password)
        if (!res.success) {
          setErrorMessage(res.error || 'Invalid credentials or login failed.')
          setIsSubmitting(false)
          return
        }

        if (role === 'admin') {
          navigate(fromLocation || '/admin/dashboard')
        } else if (role === 'helper') {
          navigate(fromLocation || '/helper/dashboard')
        } else {
          navigate(fromLocation || '/victim/dashboard')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected authentication error occurred.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Development simulation for Phase 6 scenario verification when Supabase live keys are pending
  function handleDevSimulate(simRole: UserRole, status: 'pending' | 'approved') {
    devSimulateSession({
      id: `sim-${simRole}-${Date.now()}`,
      email: `${simRole}@udupi-flood.org`,
      fullName: `Test ${simRole.toUpperCase()} (${status})`,
      role: simRole,
      organization: simRole === 'helper' ? 'Coastal Rescue volunteers' : undefined,
      approvalStatus: status,
    })

    if (simRole === 'admin') {
      navigate('/admin/dashboard')
    } else if (simRole === 'helper') {
      if (status === 'pending') {
        navigate('/helper/pending-approval')
      } else {
        navigate('/helper/dashboard')
      }
    } else {
      navigate('/victim/dashboard')
    }
  }

  return (
    <div className="public-page auth-page">
      <header className="site-header content-width">
        <Brand />
        <Link className="text-action" to="/roles">
          <ArrowLeft size={15} aria-hidden="true" /> Change role
        </Link>
      </header>

      <main className="auth-main content-width">
        <section className="auth-panel">
          <div className="auth-panel-topline">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>{roleLabel.toUpperCase()} ACCESS</span>
            {!isConfigured && <span className="auth-prototype">AWAITING .ENV</span>}
          </div>

          <PageHeader
            eyebrow={isSignup ? 'PROFILE SETUP' : 'WELCOME BACK'}
            title={isSignup ? `Register as ${roleLabel}` : `${roleLabel} sign in`}
            description={
              isSignup
                ? `Create your ${roleLabel.toLowerCase()} profile for disaster intelligence and response.`
                : `Sign in to access your ${roleLabel.toLowerCase()} tools.`
            }
          />

          {!isConfigured && (
            <Alert className="prototype-warning" role="note">
              <AlertTitle>Supabase Integration Setup Notice</AlertTitle>
              <AlertDescription>
                Live authentication is awaiting configuration in <code>.env</code> (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).
                You can use the simulated testing buttons below to test all role scenarios.
              </AlertDescription>
            </Alert>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <FormField id="full-name" label="Full name" name="full-name" autoComplete="name" required />
            )}
            <FormField
              id="identity"
              label={isHelper || isAdmin ? 'Email address' : 'Email address'}
              name="identity"
              type="email"
              autoComplete="username"
              required
            />
            {isSignup && isHelper && (
              <FormField
                id="organization"
                label="Organization or response group"
                name="organization"
                autoComplete="organization"
                required
              />
            )}
            <div className="form-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label className="field-label" htmlFor="password">
                  Password
                </Label>
                {!isSignup && (
                  <Link to="/reset-password" style={{ fontSize: '13px', color: 'var(--brand-primary, #0284c7)' }}>
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="password-input-wrap">
                <Input
                  className="text-input"
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
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
              {isSignup && <p className="field-hint">Use at least 8 characters.</p>}
            </div>

            {isSignup && (
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

            <Button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Authenticating…' : isSignup ? 'Complete registration' : 'Sign in'}
            </Button>

            {errorMessage && (
              <p className="form-message" style={{ color: '#dc2626' }} role="alert">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="form-message" style={{ color: '#16a34a' }} role="status">
                {successMessage}
              </p>
            )}
          </form>

          {/* Development scenario simulator for verifying Phase 6 roles without mock fallback pollution */}
          {!isConfigured && (
            <div style={{ marginTop: '20px', padding: '12px', background: 'var(--slate-3, #f1f5f9)', borderRadius: '6px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-11, #475569)', marginBottom: '8px' }}>
                PHASE 6 TEST SCENARIO SIMULATOR (Preview without live DB):
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="button button-small"
                  onClick={() => handleDevSimulate('victim', 'approved')}
                >
                  Citizen (Citizen)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="button button-small"
                  onClick={() => handleDevSimulate('helper', 'pending')}
                >
                  Pending Helper
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="button button-small"
                  onClick={() => handleDevSimulate('helper', 'approved')}
                >
                  Approved Helper
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="button button-small"
                  onClick={() => handleDevSimulate('admin', 'approved')}
                >
                  Administrator
                </Button>
              </div>
            </div>
          )}

          <p className="auth-switch">
            {isSignup ? 'Already registered?' : 'New to ABHEDYA?'}{' '}
            <Link to={`/${role}/${isSignup ? 'login' : 'signup'}`}>
              {isSignup ? 'Sign in' : 'Register'}
            </Link>
          </p>

          <Link className="auth-back" to="/roles">
            <ArrowLeft size={14} aria-hidden="true" /> Return to role selection
          </Link>
        </section>

        <aside className="auth-aside">
          <p className="eyebrow">ABHEDYA / {roleLabel.toUpperCase()}</p>
          <p className="auth-aside-tagline">Before.<br />During.<br />Beyond.</p>
          <p>
            {isHelper
              ? 'Volunteers and response teams coordinate rescue and supply dispatch across Udupi.'
              : isAdmin
              ? 'District authorities manage helper approvals, incident priorities, and emergency dispatch.'
              : 'Citizens can report waterlogging, request rescue, and track situation recovery.'}
          </p>
          <Link className="text-action" to="/">
            Go to emergency SOS <ArrowLeft size={14} aria-hidden="true" />
          </Link>
        </aside>
      </main>
    </div>
  )
}

export default AuthPage
