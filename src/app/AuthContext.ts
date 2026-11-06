import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { UserRole } from '../types/domain'

export interface UserProfile {
  id: string
  role: UserRole
  account_status: 'pending' | 'active' | 'suspended'
  display_name: string | null
  phone: string | null
  organization: string | null
}

export type HelperApplicationStatus = 'pending' | 'approved' | 'rejected' | null

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  helperApplicationStatus: HelperApplicationStatus
  loading: boolean
  configured: boolean
  error: string
  refreshProfile: () => Promise<UserProfile | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
