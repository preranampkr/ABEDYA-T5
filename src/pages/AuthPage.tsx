import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import type { AuthMode, UserRole } from '../types/domain'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

interface AuthPageProps {
  role: UserRole
  mode: AuthMode
}

function AuthPage({ role, mode }: AuthPageProps) {
  const isHelper = role === 'helper'
  const isSignup = mode === 'signup'
  const roleLabel = isHelper ? 'Helper' : 'Victim'
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    if (isSignup && formData.get('password') !== formData.get('confirm-password')) {
      setMessage('Passwords do not match. Check both fields and try again.')
      return
    }

    setMessage(isSignup
      ? 'Prototype only. No account has been created or stored.'
      : 'Prototype only. Credentials are not checked and no account is stored.')
  }

  return (
    <div className="public-page auth-page">
      <header className="site-header content-width">
        <Brand />
        <Link className="text-action" to="/roles"><ArrowLeft size={15} aria-hidden="true" /> Change role</Link>
      </header>
      <main className="auth-main content-width">
        <section className="auth-panel">
          <div className="auth-panel-topline"><ShieldCheck size={17} aria-hidden="true" /><span>{roleLabel.toUpperCase()} ACCESS</span><span className="auth-prototype">PROTOTYPE</span></div>
          <PageHeader
            eyebrow={isSignup ? 'PROFILE SETUP' : 'WELCOME BACK'}
            title={isSignup ? `Register as ${roleLabel}` : `${roleLabel} sign in`}
            description={isSignup ? 'Enter your details to preview the registration flow.' : 'Enter your details to preview the sign-in flow.'}
          />
          <Alert className="prototype-warning" role="note">
            <AlertDescription>This frontend prototype does not authenticate users or store account information.</AlertDescription>
          </Alert>
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <FormField id="full-name" label="Full name" name="full-name" autoComplete="name" required />
            )}
            <FormField
              id="identity"
              label={isHelper ? 'Work email' : isSignup ? 'Email or phone' : 'Email or phone'}
              name="identity"
              type={isHelper ? 'email' : 'text'}
              autoComplete={isSignup ? 'username' : 'username'}
              minLength={isHelper ? undefined : 5}
              required
            />
            {isSignup && isHelper && (
              <FormField id="organization" label="Organization or response group" name="organization" autoComplete="organization" required />
            )}
            <div className="form-field">
              <Label className="field-label" htmlFor="password">Password</Label>
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
            <Button className="button button-primary auth-submit" type="submit">
              {isSignup ? 'Preview registration' : 'Preview sign in'}
            </Button>
            {message && <p className="form-message" role="status" aria-live="polite">{message}</p>}
          </form>
          <div className="auth-dev-actions">
            <Button asChild className="button button-outline button-small" variant="outline" size="sm">
              <Link to={`/${role}/dashboard`}>Open dashboard (development access)</Link>
            </Button>
            <Button asChild className="button button-outline button-small" variant="outline" size="sm">
              <Link to={`/${role}/drishti`}>Open DRISHTI (development access)</Link>
            </Button>
          </div>
          <p className="auth-switch">
            {isSignup ? 'Already have a profile?' : 'New to ABHEDYA?'}{' '}
            <Link to={`/${role}/${isSignup ? 'login' : 'signup'}`}>{isSignup ? 'Sign in' : 'Register'}</Link>
          </p>
          <Link className="auth-back" to="/roles"><ArrowLeft size={14} aria-hidden="true" /> Return to role selection</Link>
        </section>
        <aside className="auth-aside">
          <p className="eyebrow">ABHEDYA / {roleLabel.toUpperCase()}</p>
          <p className="auth-aside-tagline">Before.<br />During.<br />Beyond.</p>
          <p>Access flows are shown for preview. SOS remains available without signing in.</p>
          <Link className="text-action" to="/">Go to emergency SOS <ArrowLeft size={14} aria-hidden="true" /></Link>
        </aside>
      </main>
    </div>
  )
}

export default AuthPage