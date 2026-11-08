import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import type { UserRole } from '../types/domain'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRole?: UserRole
  allowedRoles?: UserRole[]
  requireApprovedHelper?: boolean
}

export function ProtectedRoute({
  children,
  allowedRole,
  allowedRoles,
  requireApprovedHelper = true,
}: ProtectedRouteProps) {
  const { profile, role, approvalStatus, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        className="public-page"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p className="field-hint" role="status" aria-live="polite">
          Verifying credentials and security permissions…
        </p>
      </div>
    )
  }

  // Not authenticated: redirect to login
  if (!profile) {
    const loginPath = allowedRole ? `/${allowedRole}/login` : '/roles'
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  // Check role authorization
  const permittedRoles = allowedRoles || (allowedRole ? [allowedRole] : [])
  if (permittedRoles.length > 0 && role && !permittedRoles.includes(role)) {
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (role === 'helper') return <Navigate to="/helper/dashboard" replace />
    return <Navigate to="/victim/dashboard" replace />
  }

  // Check helper approval status
  if (role === 'helper' && requireApprovedHelper) {
    if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
      return <Navigate to="/helper/pending-approval" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute
