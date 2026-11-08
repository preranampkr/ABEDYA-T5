import { Check, Clock, ShieldCheck, UserCheck, UserX, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { ApprovalStatus, UserProfile } from '../types/domain'

// Sample initial data when in prototype/demo mode
const initialMockHelpers: UserProfile[] = [
  {
    id: 'hlp-mock-1',
    email: 'kavitha.udupi@redcross.org',
    fullName: 'Dr. Kavitha Shenoy',
    role: 'helper',
    organization: 'Indian Red Cross Society, Udupi Sub-branch',
    approvalStatus: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'hlp-mock-2',
    email: 'naveen.shetty@coastalrescue.in',
    fullName: 'Naveen Shetty',
    role: 'helper',
    organization: 'Malpe Coastal Volunteer Lifeguards',
    approvalStatus: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'hlp-mock-3',
    email: 'm.rao@disaster.karnataka.gov.in',
    fullName: 'Manjunath Rao',
    role: 'helper',
    organization: 'District Disaster Management Authority (DDMA)',
    approvalStatus: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
]

export function AdminHelpersPage() {
  const [helpers, setHelpers] = useState<UserProfile[]>(initialMockHelpers)
  const [filter, setFilter] = useState<'all' | ApprovalStatus>('all')
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')

  async function loadHelpers() {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'helper')
        .order('created_at', { ascending: false })

      if (error) {
        setActionError(`Failed to load helpers: ${error.message}`)
      } else if (data) {
        const loaded: UserProfile[] = data.map((d) => ({
          id: d.id,
          email: d.email,
          fullName: d.full_name,
          role: 'helper',
          organization: d.organization || undefined,
          approvalStatus: d.approval_status as ApprovalStatus,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }))
        setHelpers(loaded)
      }
    } catch (err) {
      console.error(err)
      setActionError('Error connecting to Supabase profiles table.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHelpers()
  }, [])

  async function handleSetStatus(helperId: string, newStatus: ApprovalStatus) {
    setActionError('')
    setSuccessNotice('')

    if (isSupabaseConfigured && supabase) {
      try {
        // Try calling stored function set_helper_approval first, otherwise fallback to update
        const { error: rpcError } = await supabase.rpc('set_helper_approval', {
          target_user_id: helperId,
          new_status: newStatus,
        })

        if (rpcError) {
          // If RPC is not created yet, try direct update via RLS admin policy
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ approval_status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', helperId)

          if (updateError) {
            setActionError(`Database error: ${updateError.message}`)
            return
          }
        }

        setSuccessNotice(`Helper successfully marked as ${newStatus}.`)
        await loadHelpers()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Operation failed.'
        setActionError(msg)
      }
    } else {
      // Local prototype state update
      setHelpers((current) =>
        current.map((h) => (h.id === helperId ? { ...h, approvalStatus: newStatus } : h))
      )
      setSuccessNotice(`Helper status updated to ${newStatus} (in-memory mode).`)
    }
  }

  const filteredHelpers = helpers.filter((h) => filter === 'all' || h.approvalStatus === filter)
  const pendingCount = helpers.filter((h) => h.approvalStatus === 'pending').length

  return (
    <DashboardLayout
      role="admin"
      title="Helper Verification & Approvals"
      description="Authorize response groups, field coordinators, and emergency volunteers."
      eyebrow="ADMINISTRATION / VERIFICATION"
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        <Alert className="environment-notice" role="note">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <AlertTitle>Strict Role-Based Access Enforcement</AlertTitle>
            <AlertDescription>
              Only authorized helpers gain access to incident queues and victim contact phone numbers. Pending applicants are blocked from all responder actions until verified.
            </AlertDescription>
          </div>
        </Alert>

        {actionError && (
          <p className="form-message" style={{ color: '#dc2626' }} role="alert">
            {actionError}
          </p>
        )}

        {successNotice && (
          <p className="form-message" style={{ color: '#16a34a' }} role="status">
            {successNotice}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
              <Button
                key={tab}
                variant={filter === tab ? 'default' : 'outline'}
                size="sm"
                className="button button-small"
                onClick={() => setFilter(tab)}
              >
                {tab === 'all' ? 'All Applicants' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'pending' && pendingCount > 0 && (
                  <span style={{ marginLeft: '6px', background: '#d97706', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>
                    {pendingCount}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={loadHelpers} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh list'}
          </Button>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--slate-6, #e2e8f0)', borderRadius: '8px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--slate-2, #f8fafc)', borderBottom: '1px solid var(--slate-6, #e2e8f0)' }}>
                <th style={{ padding: '12px 16px' }}>Applicant</th>
                <th style={{ padding: '12px 16px' }}>Organization</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHelpers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--slate-9, #64748b)' }}>
                    No helper records found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredHelpers.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--slate-4, #f1f5f9)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ display: 'block', color: 'var(--slate-12, #0f172a)' }}>{h.fullName}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--slate-10, #64748b)' }}>{h.email}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--slate-11, #334155)' }}>
                      {h.organization || 'Independent volunteer'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background:
                            h.approvalStatus === 'approved'
                              ? '#dcfce7'
                              : h.approvalStatus === 'rejected'
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            h.approvalStatus === 'approved'
                              ? '#15803d'
                              : h.approvalStatus === 'rejected'
                              ? '#b91c1c'
                              : '#b45309',
                        }}
                      >
                        {h.approvalStatus === 'approved' && <UserCheck size={13} />}
                        {h.approvalStatus === 'rejected' && <UserX size={13} />}
                        {h.approvalStatus === 'pending' && <Clock size={13} />}
                        {h.approvalStatus.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {h.approvalStatus !== 'approved' && (
                          <Button
                            size="sm"
                            className="button button-small"
                            style={{ background: '#16a34a', color: '#fff' }}
                            onClick={() => handleSetStatus(h.id, 'approved')}
                          >
                            <Check size={14} /> Approve
                          </Button>
                        )}
                        {h.approvalStatus !== 'rejected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="button button-small"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleSetStatus(h.id, 'rejected')}
                          >
                            <X size={14} /> Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default AdminHelpersPage
