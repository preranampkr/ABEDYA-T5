import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { Button } from '../components/ui/button'
import { useAuth } from '../app/AuthContext'
import { supabase } from '../lib/supabase'

interface HelperApplication {
  id: string
  userId: string
  displayName: string | null
  phone: string | null
  organization: string
  applicationDetails: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
  createdAt: string
}

function AdminUsersPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState<HelperApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    if (!supabase) return () => { active = false }

    void supabase.rpc('admin_list_helper_requests').then(({ data, error: requestError }) => {
      if (!active) return
      if (requestError) {
        setError(requestError.message)
      } else {
        setApplications((data ?? []) as HelperApplication[])
      }
      setLoading(false)
    })

    return () => { active = false }
  }, [])

  async function loadApplications() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('admin_list_helper_requests')
    if (requestError) {
      setError(requestError.message)
    } else {
      setApplications((data ?? []) as HelperApplication[])
    }
    setLoading(false)
  }

  async function reviewApplication(application: HelperApplication, decision: 'approved' | 'rejected') {
    if (!supabase) return
    setBusyId(application.id)
    setError('')
    setMessage('')
    const { error: requestError } = await supabase.rpc('admin_review_helper_request', {
      p_request_id: application.id,
      p_decision: decision,
      p_review_note: null,
    })
    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(`Helper application ${decision}.`)
      await loadApplications()
    }
    setBusyId('')
  }

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch {
      setError('Unable to sign out. Please try again.')
    }
  }

  return (
    <div className="public-page">
      <header className="site-header content-width">
        <Brand />
        <Button className="button button-outline button-small" variant="outline" size="sm" onClick={() => void handleSignOut()}>Sign out</Button>
      </header>
      <main className="role-page content-width">
        <div className="section-heading">
          <div><p className="eyebrow">ADMINISTRATION / ACCESS CONTROL</p><h1>Helper applications</h1></div>
          <Button className="button button-outline button-small" variant="outline" size="sm" onClick={() => void loadApplications()}>Refresh</Button>
        </div>
        {loading && <p role="status">Loading applications…</p>}
        {error && <p className="form-message auth-error" role="alert">{error}</p>}
        {message && <p className="form-message" role="status">{message}</p>}
        {!loading && !applications.length && <p>No helper applications found.</p>}
        <div className="module-grid">
          {applications.map((application) => (
            <article className="module-card" key={application.id}>
              <div className="module-card-topline"><span>{application.status.toUpperCase()}</span><span>{new Date(application.createdAt).toLocaleDateString()}</span></div>
              <h2>{application.displayName || 'Name not provided'}</h2>
              <p>{application.organization}</p>
              <p>{application.applicationDetails}</p>
              {application.phone && <p>Phone: {application.phone}</p>}
              {application.reviewNote && <p>{application.reviewNote}</p>}
              {application.status === 'pending' && (
                <div className="sanket-actions">
                  <Button className="button button-primary" disabled={busyId === application.id} onClick={() => void reviewApplication(application, 'approved')}>Approve helper</Button>
                  <Button className="button button-outline" variant="outline" disabled={busyId === application.id} onClick={() => void reviewApplication(application, 'rejected')}>Reject</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}

export default AdminUsersPage