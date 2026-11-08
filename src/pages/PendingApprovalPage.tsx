import { ArrowLeft, Clock, LogOut, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import PageHeader from '../components/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { useAuth } from '../features/auth/AuthContext'

export function PendingApprovalPage() {
  const { profile, approvalStatus, refreshProfile, signOut } = useAuth()
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const isRejected = approvalStatus === 'rejected'

  async function handleRefresh() {
    setChecking(true)
    setMessage('')
    try {
      await refreshProfile()
      if (approvalStatus === 'approved') {
        navigate('/helper/dashboard')
      } else if (approvalStatus === 'rejected') {
        setMessage('Your profile review was rejected by district administration.')
      } else {
        setMessage('Your profile is still pending administrator approval.')
      }
    } catch {
      setMessage('Failed to check status. Try again later.')
    } finally {
      setChecking(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/roles')
  }

  return (
    <div className="public-page auth-page">
      <header className="site-header content-width">
        <Brand />
        <Link className="text-action" to="/roles">
          <ArrowLeft size={15} aria-hidden="true" /> Exit
        </Link>
      </header>

      <main className="auth-main content-width">
        <section className="auth-panel" style={{ maxWidth: '640px' }}>
          <div className="auth-panel-topline">
            {isRejected ? <XCircle size={17} aria-hidden="true" style={{ color: '#dc2626' }} /> : <Clock size={17} aria-hidden="true" />}
            <span>HELPER APPLICATION</span>
            <span
              className="auth-prototype"
              style={{
                background: isRejected ? '#fee2e2' : 'var(--amber-alpha-10, #ffedd5)',
                color: isRejected ? '#b91c1c' : 'var(--amber-11, #b45309)',
              }}
            >
              {isRejected ? 'REJECTED' : 'PENDING REVIEW'}
            </span>
          </div>

          <PageHeader
            eyebrow={isRejected ? 'APPLICATION REVIEWED' : 'REGISTRATION SUBMITTED'}
            title={isRejected ? 'Application Not Approved' : 'Awaiting District Verification'}
            description={
              isRejected
                ? 'Your registration as an emergency helper could not be approved by Udupi District Administration.'
                : 'Your registration as an emergency helper has been recorded and is currently pending verification by Udupi District Administration.'
            }
          />

          <Alert className="environment-notice" role="note">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <AlertTitle>Protected Citizen Safety Protocol</AlertTitle>
              <AlertDescription>
                {isRejected
                  ? 'Access to live citizen incident queues, distress coordinates, and contact details is strictly restricted to verified disaster responders.'
                  : 'Live citizen coordinates, SOS reports, and telephone numbers are restricted under strict privacy policies. Access is granted only after administrator authorization.'}
              </AlertDescription>
            </div>
          </Alert>

          {profile && (
            <div
              style={{
                margin: '20px 0',
                padding: '16px',
                background: 'var(--slate-2, #f8fafc)',
                borderRadius: '8px',
                border: '1px solid var(--slate-6, #e2e8f0)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '14px' }}>
                <span style={{ color: 'var(--slate-10, #64748b)' }}>Applicant:</span>
                <strong>{profile.fullName}</strong>
                <span style={{ color: 'var(--slate-10, #64748b)' }}>Email:</span>
                <strong>{profile.email}</strong>
                {profile.organization && (
                  <>
                    <span style={{ color: 'var(--slate-10, #64748b)' }}>Organization:</span>
                    <strong>{profile.organization}</strong>
                  </>
                )}
                <span style={{ color: 'var(--slate-10, #64748b)' }}>Current Status:</span>
                <span style={{ color: isRejected ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                  {isRejected ? 'Application Rejected' : 'Verification Pending'}
                </span>
              </div>
            </div>
          )}

          {message && (
            <p className="form-message" role="status" style={{ margin: '12px 0' }}>
              {message}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
            {!isRejected && (
              <Button
                type="button"
                className="button button-primary"
                onClick={handleRefresh}
                disabled={checking}
              >
                <RefreshCw size={15} className={checking ? 'animate-spin' : ''} aria-hidden="true" />
                {checking ? 'Checking status…' : 'Check approval status'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="button button-outline"
              onClick={handleSignOut}
            >
              <LogOut size={15} aria-hidden="true" /> Sign out
            </Button>
          </div>
        </section>

        <aside className="auth-aside">
          <p className="eyebrow">ABHEDYA / HELPER</p>
          <p className="auth-aside-tagline">Before.<br />During.<br />Beyond.</p>
          <p>
            Emergency coordinators review helper credentials to guarantee accountability and ensure prompt aid dispatch across Udupi taluks.
          </p>
          <Link className="text-action" to="/">
            Go to emergency SOS <ArrowLeft size={14} aria-hidden="true" />
          </Link>
        </aside>
      </main>
    </div>
  )
}

export default PendingApprovalPage
