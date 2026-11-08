import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { ApprovalStatus, UserProfile, UserRole } from '../../types/domain'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  role: UserRole | null
  approvalStatus: ApprovalStatus | null
  isLoading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (params: {
    email: string
    password: string
    fullName: string
    role: UserRole
    organization?: string
  }) => Promise<{ success: boolean; error?: string; approvalStatus?: ApprovalStatus }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
  // Development simulation helper when Supabase credentials have not yet been provided by administrator
  devSimulateSession: (simulatedProfile: UserProfile) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEV_STORAGE_KEY = 'abhedya_dev_simulated_profile'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (!isSupabaseConfigured) {
      try {
        const saved = localStorage.getItem(DEV_STORAGE_KEY)
        return saved ? JSON.parse(saved) : null
      } catch {
        return null
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(() => Boolean(isSupabaseConfigured))

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    if (!supabase) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Could not load profile from Supabase:', error.message)
        return null
      }

      if (data) {
        return {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role as UserRole,
          organization: data.organization || undefined,
          approvalStatus: (data.approval_status as ApprovalStatus) || 'pending',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err)
    }
    return null
  }

  async function refreshProfile() {
    if (user && supabase) {
      const userProfile = await fetchProfile(user.id)
      if (userProfile) {
        setProfile(userProfile)
      }
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    let isMounted = true

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase!.auth.getSession()
        if (session?.user && isMounted) {
          setUser(session.user)
          const userProfile = await fetchProfile(session.user.id)
          if (isMounted) {
            setProfile(userProfile)
          }
        }
      } catch (err) {
        console.error('Failed to restore Supabase auth session:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        const userProfile = await fetchProfile(session.user.id)
        if (isMounted) {
          setProfile(userProfile)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase credentials are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.user) {
        setUser(data.user)
        const userProfile = await fetchProfile(data.user.id)
        setProfile(userProfile)
      }

      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Please check your credentials.'
      return { success: false, error: message }
    }
  }

  async function signUp(params: {
    email: string
    password: string
    fullName: string
    role: UserRole
    organization?: string
  }): Promise<{ success: boolean; error?: string; approvalStatus?: ApprovalStatus }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase credentials are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
      }
    }

    try {
      const initialApproval: ApprovalStatus = params.role === 'victim' ? 'approved' : 'pending'

      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
            role: params.role,
            organization: params.organization || null,
          },
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.user) {
        setUser(data.user)
        // Also ensure profile row is created/upserted directly in case trigger has delay
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email: params.email,
          full_name: params.fullName,
          role: params.role,
          organization: params.organization || null,
          approval_status: initialApproval,
        })

        if (profileError) {
          console.warn('Direct profile upsert returned warning:', profileError.message)
        }

        const userProfile = await fetchProfile(data.user.id)
        setProfile(
          userProfile ?? {
            id: data.user.id,
            email: params.email,
            fullName: params.fullName,
            role: params.role,
            organization: params.organization,
            approvalStatus: initialApproval,
          }
        )

        return { success: true, approvalStatus: initialApproval }
      }

      return { success: true, approvalStatus: initialApproval }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      return { success: false, error: message }
    }
  }

  async function signOut(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setProfile(null)
    localStorage.removeItem(DEV_STORAGE_KEY)
  }

  async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase credentials are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
      }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset request failed.'
      return { success: false, error: message }
    }
  }

  async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase credentials are not configured.',
      }
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password.'
      return { success: false, error: message }
    }
  }

  function devSimulateSession(simulatedProfile: UserProfile) {
    if (isSupabaseConfigured) {
      console.warn('devSimulateSession is disabled when Supabase is configured.')
      return
    }
    setProfile(simulatedProfile)
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(simulatedProfile))
  }

  const role = profile?.role ?? null
  const approvalStatus = profile?.approvalStatus ?? null

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        approvalStatus,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
        devSimulateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
