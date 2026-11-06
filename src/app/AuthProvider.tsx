import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AuthContext, type HelperApplicationStatus, type UserProfile } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [helperApplicationStatus, setHelperApplicationStatus] = useState<HelperApplicationStatus>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return

    let active = true
    let generation = 0

    async function hydrate(nextSession: Session | null) {
      const currentGeneration = ++generation
      setSession(nextSession)
      setError('')

      if (!nextSession) {
        setProfile(null)
        setHelperApplicationStatus(null)
        setLoading(false)
        return
      }

      setLoading(true)
      const [profileResult, applicationResult] = await Promise.all([
        supabase!.from('user_profiles')
          .select('id, role, account_status, display_name, phone, organization')
          .eq('id', nextSession.user.id)
          .maybeSingle(),
        supabase!.from('helper_access_requests')
          .select('status')
          .eq('user_id', nextSession.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (!active || currentGeneration !== generation) return
      if (profileResult.error) {
        setError(profileResult.error.message)
        setProfile(null)
      } else {
        setProfile(profileResult.data as UserProfile | null)
      }
      if (applicationResult.error) {
        setError((current) => current || applicationResult.error.message)
        setHelperApplicationStatus(null)
      } else {
        setHelperApplicationStatus((applicationResult.data?.status as HelperApplicationStatus) ?? null)
      }
      setLoading(false)
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession)
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      void hydrate(data.session)
    })

    return () => {
      active = false
      generation += 1
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function refreshProfile() {
    if (!supabase || !session) return null
    const [profileResult, applicationResult] = await Promise.all([
      supabase.from('user_profiles')
        .select('id, role, account_status, display_name, phone, organization')
        .eq('id', session.user.id)
        .maybeSingle(),
      supabase.from('helper_access_requests')
        .select('status')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (profileResult.error) throw profileResult.error
    if (applicationResult.error) throw applicationResult.error
    const nextProfile = profileResult.data as UserProfile | null
    setProfile(nextProfile)
    setHelperApplicationStatus((applicationResult.data?.status as HelperApplicationStatus) ?? null)
    setError('')
    return nextProfile
  }

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
    setSession(null)
    setProfile(null)
    setHelperApplicationStatus(null)
  }

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      helperApplicationStatus,
      loading,
      configured: isSupabaseConfigured,
      error,
      refreshProfile,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}