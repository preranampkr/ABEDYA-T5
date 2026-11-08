import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { useAuth } from '../features/auth/AuthContext'

export function ResetPasswordPage() {
  const { resetPassword, updatePassword, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  // Check if this is an active recovery session (Supabase attaches hash tokens on password recovery link)
  const isRecoverySession = window.location.hash.includes('type=recovery')

  async function handleRequestReset(e: FormEvent) {
    e.preventDefault()
    setErrorMessage('')
    setStatusMessage('')
    setIsSubmitting(true)

    const res = await resetPassword(email)
    setIsSubmitting(false)

    if (res.success) {
      setStatusMessage('Password reset instructions have been sent to your email address.')
    } else {
      setErrorMessage(res.error || 'Failed to request password reset.')
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }
    setErrorMessage('')
    setStatusMessage('')
    setIsSubmitting(true)

    const res = await updatePassword(newPassword)
    setIsSubmitting(false)

    if (res.success) {
      setStatusMessage('Your password has been successfully updated. Redirecting to sign in…')
      setTimeout(() => navigate('/roles'), 2000)
    } else {
      setErrorMessage(res.error || 'Failed to update password.')
    }
  }

  return (
    <div className="public-page auth-page">
      <header className="site-header content-width">
        <Brand />
        <Link className="text-action" to="/roles">
          <ArrowLeft size={15} aria-hidden="true" /> Return to roles
        </Link>
      </header>

      <main className="auth-main content-width">
        <section className="auth-panel" style={{ maxWidth: '520px' }}>
          <div className="auth-panel-topline">
            <KeyRound size={17} aria-hidden="true" />
            <span>SECURITY RECOVERY</span>
          </div>

          <PageHeader
            eyebrow="ACCOUNT RECOVERY"
            title={isRecoverySession ? 'Set new password' : 'Reset your password'}
            description={
              isRecoverySession
                ? 'Enter your new account password below.'
                : 'Enter your registered email address to receive password reset instructions.'
            }
          />

          {!isConfigured && (
            <Alert className="prototype-warning" role="note">
              <AlertDescription>
                Supabase credentials are not configured in .env. Password reset emails require an active Supabase project.
              </AlertDescription>
            </Alert>
          )}

          {isRecoverySession ? (
            <form className="auth-form" onSubmit={handleUpdatePassword}>
              <FormField
                id="new-password"
                label="New password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <FormField
                id="confirm-new-password"
                label="Confirm new password"
                name="confirm-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating password…' : 'Update password'}
              </Button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRequestReset}>
              <FormField
                id="recovery-email"
                label="Registered email address"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending instructions…' : 'Send reset link'}
              </Button>
            </form>
          )}

          {statusMessage && (
            <p className="form-message" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }} role="status">
              <CheckCircle2 size={16} /> {statusMessage}
            </p>
          )}

          {errorMessage && (
            <p className="form-message" style={{ color: '#dc2626' }} role="alert">
              {errorMessage}
            </p>
          )}

          <p className="auth-switch">
            Remembered your password? <Link to="/roles">Sign in</Link>
          </p>
        </section>

        <aside className="auth-aside">
          <p className="eyebrow">ABHEDYA / RECOVERY</p>
          <p className="auth-aside-tagline">Before.<br />During.<br />Beyond.</p>
          <p>
            Emergency SOS remains available without signing in. You do not need to recover your password to submit an urgent distress signal.
          </p>
          <Link className="text-action" to="/">
            Go to emergency SOS <ArrowLeft size={14} aria-hidden="true" />
          </Link>
        </aside>
      </main>
    </div>
  )
}

export default ResetPasswordPage
