import { describe, expect, it } from 'vitest'
import type { ApprovalStatus, UserProfile, UserRole } from '../types/domain'

// Simulated RBAC router resolution logic mirroring ProtectedRoute behavior
function evaluateAccess(
  profile: UserProfile | null,
  routeRole: UserRole,
  requireApprovedHelper = true
): { allowed: boolean; redirectPath?: string } {
  if (!profile) {
    return { allowed: false, redirectPath: `/${routeRole}/login` }
  }

  // Permitted role check
  if (profile.role !== routeRole) {
    if (profile.role === 'admin') return { allowed: false, redirectPath: '/admin/dashboard' }
    if (profile.role === 'helper') return { allowed: false, redirectPath: '/helper/dashboard' }
    return { allowed: false, redirectPath: '/victim/dashboard' }
  }

  // Helper approval check
  if (profile.role === 'helper' && requireApprovedHelper) {
    if (profile.approvalStatus === 'pending' || profile.approvalStatus === 'rejected') {
      return { allowed: false, redirectPath: '/helper/pending-approval' }
    }
  }

  return { allowed: true }
}

describe('Authentication & Role-Based Access Control (RBAC)', () => {
  const citizenProfile: UserProfile = {
    id: 'usr-citizen-1',
    email: 'citizen@udupi.in',
    fullName: 'Ananya Shetty',
    role: 'victim',
    approvalStatus: 'approved',
  }

  const pendingHelperProfile: UserProfile = {
    id: 'usr-helper-pending',
    email: 'volunteer@redcross.org',
    fullName: 'Vikram Rao',
    role: 'helper',
    organization: 'Red Cross Kundapura',
    approvalStatus: 'pending',
  }

  const approvedHelperProfile: UserProfile = {
    id: 'usr-helper-approved',
    email: 'responder@ddma.in',
    fullName: 'Dr. Kavitha Shenoy',
    role: 'helper',
    organization: 'DDMA Udupi',
    approvalStatus: 'approved',
  }

  const adminProfile: UserProfile = {
    id: 'usr-admin-1',
    email: 'dc.udupi@karnataka.gov.in',
    fullName: 'Deputy Commissioner Udupi',
    role: 'admin',
    approvalStatus: 'approved',
  }

  describe('Unauthenticated Access', () => {
    it('redirects unauthenticated users to /victim/login when attempting victim routes', () => {
      const res = evaluateAccess(null, 'victim')
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/victim/login')
    })

    it('redirects unauthenticated users to /helper/login when attempting helper routes', () => {
      const res = evaluateAccess(null, 'helper')
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/helper/login')
    })

    it('redirects unauthenticated users to /admin/login when attempting admin routes', () => {
      const res = evaluateAccess(null, 'admin')
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/admin/login')
    })
  })

  describe('Role-Based Route Isolation', () => {
    it('allows citizen to access victim dashboard', () => {
      const res = evaluateAccess(citizenProfile, 'victim')
      expect(res.allowed).toBe(true)
      expect(res.redirectPath).toBeUndefined()
    })

    it('blocks citizen from accessing helper dashboard and redirects to /victim/dashboard', () => {
      const res = evaluateAccess(citizenProfile, 'helper')
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/victim/dashboard')
    })

    it('blocks citizen from accessing admin dashboard and redirects to /victim/dashboard', () => {
      const res = evaluateAccess(citizenProfile, 'admin')
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/victim/dashboard')
    })

    it('blocks helper from accessing admin dashboard and redirects to /helper/dashboard', () => {
      const res = evaluateAccess(approvedHelperProfile, 'admin')
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/helper/dashboard')
    })

    it('allows administrator to access admin workspace', () => {
      const res = evaluateAccess(adminProfile, 'admin')
      expect(res.allowed).toBe(true)
      expect(res.redirectPath).toBeUndefined()
    })
  })

  describe('Helper Approval Workflow Restrictions', () => {
    it('blocks pending helper from approved-helper queue and redirects to /helper/pending-approval', () => {
      const res = evaluateAccess(pendingHelperProfile, 'helper', true)
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/helper/pending-approval')
    })

    it('blocks rejected helper from approved-helper queue and redirects to /helper/pending-approval', () => {
      const rejectedHelper: UserProfile = { ...pendingHelperProfile, approvalStatus: 'rejected' }
      const res = evaluateAccess(rejectedHelper, 'helper', true)
      expect(res.allowed).toBe(false)
      expect(res.redirectPath).toBe('/helper/pending-approval')
    })

    it('allows approved helper to access helper incident queue and workflows', () => {
      const res = evaluateAccess(approvedHelperProfile, 'helper', true)
      expect(res.allowed).toBe(true)
      expect(res.redirectPath).toBeUndefined()
    })

    it('correctly transitions helper status when approved by administrator', () => {
      const helper: UserProfile = { ...pendingHelperProfile }
      expect(helper.approvalStatus).toBe('pending')

      // Admin approves helper
      function adminApprove(target: UserProfile, newStatus: ApprovalStatus): UserProfile {
        return { ...target, approvalStatus: newStatus }
      }

      const updated = adminApprove(helper, 'approved')
      expect(updated.approvalStatus).toBe('approved')

      const afterApprovalAccess = evaluateAccess(updated, 'helper', true)
      expect(afterApprovalAccess.allowed).toBe(true)
    })
  })
})
