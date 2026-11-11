import { ArrowUpRight, Check, LayoutDashboard, LocateFixed, LogOut, Navigation, PhoneCall, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { disableLocalPreview, isLocalPreviewEnabled } from '../lib/localPreview'
import { modulesByRole, roleLabels } from '../data/modules'
import type { WorkspaceRole } from '../types/domain'
import { reportRepository } from '../features/sanket/data/reportRepository'
import type { EmergencyDispatchNotification } from '../features/sanket/types'
import Brand from './Brand'
import PageHeader from './PageHeader'
import { Button } from './ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from './ui/sidebar'

interface DashboardLayoutProps {
  role: WorkspaceRole
  title: string
  description: string
  eyebrow?: string
  wide?: boolean
  hidePageHeader?: boolean
  children: React.ReactNode
}

function playTacticalChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // First pulse: 880Hz (A5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.2, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.25)

    // Second pulse: 1174.66Hz (D6)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1174.66, now + 0.15)
    gain2.gain.setValueAtTime(0.25, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)
  } catch {
    // Autoplay restrictions catch
  }
}

function DashboardNavigation({ role, activeSosCount = 0 }: { role: WorkspaceRole; activeSosCount?: number }) {
  const { pathname } = useLocation()
  const dashboardPath = `/${role}/dashboard`

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === dashboardPath}>
          <NavLink to={dashboardPath} end style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard aria-hidden="true" /> <span>Overview</span>
            </div>
            {role === 'helper' && activeSosCount > 0 && (
              <span
                style={{
                  background: 'rgba(239, 143, 143, 0.2)',
                  color: 'var(--accent-coral)',
                  border: '1px solid var(--accent-coral)',
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {activeSosCount}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {modulesByRole[role].map((module) => {
        const Icon = module.icon
        const isSanket = module.id === 'sanket'
        const isDrishti = module.id === 'drishti'
        const isSena = module.id === 'sena'

        return (
          <SidebarMenuItem key={module.id}>
            <SidebarMenuButton asChild isActive={pathname === module.path}>
              <NavLink to={module.path} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon aria-hidden="true" /> <span>{module.name}</span>
                </div>
                {role === 'helper' && activeSosCount > 0 && isSanket && (
                  <span
                    style={{
                      background: '#93000a',
                      color: '#ffffff',
                      border: '1px solid #ffb4ab',
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    ● {activeSosCount} SOS
                  </span>
                )}
                {role === 'helper' && activeSosCount > 0 && (isDrishti || isSena) && (
                  <span
                    style={{
                      background: 'rgba(239, 143, 143, 0.15)',
                      color: 'var(--accent-coral)',
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '8px',
                    }}
                  >
                    ● SOS
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function DashboardLayout({ role, title, description, eyebrow, wide = false, hidePageHeader = false, children }: DashboardLayoutProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')
  const localPreview = !isSupabaseConfigured && isLocalPreviewEnabled()

  // Real-time Emergency SOS Dispatch notifications for Helpers
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyDispatchNotification[]>(() => {
    if (role !== 'helper') return []
    return reportRepository.getEmergencyNotifications().filter((n) => !n.acknowledged)
  })

  useEffect(() => {
    if (role !== 'helper') return
    const unsubscribe = reportRepository.subscribeEmergency((notification) => {
      setActiveEmergencies((current) => {
        if (notification.acknowledged) {
          return current.filter((n) => n.id !== notification.id && n.reportId !== notification.reportId)
        }
        return [notification, ...current.filter((n) => n.id !== notification.id)]
      })
      if (!notification.acknowledged) {
        playTacticalChime()
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🚨 ABHEDYA EMERGENCY SOS', {
              body: `${notification.reporter.name}: ${notification.summary}`,
            })
          } catch {
            // ignore
          }
        }
      }
    })
    return unsubscribe
  }, [role])

  const handleAcknowledge = (id: string) => {
    reportRepository.acknowledgeEmergency(id, 'SAR Field Responder')
    setActiveEmergencies((cur) => cur.filter((n) => n.id !== id && n.reportId !== id))
  }

  async function handleSignOut() {
    setSignOutError('')
    try {
      if (localPreview) disableLocalPreview()
      await signOut()
      navigate('/', { replace: true })
    } catch {
      setSignOutError('Unable to sign out. Please try again.')
    }
  }

  return (
    <SidebarProvider className="dashboard-layout">
      <Sidebar className="dashboard-sidebar">
        <SidebarHeader className="dashboard-sidebar-header">
          <Brand />
          <div className="workspace-role"><span className="workspace-role-label">ACTIVE WORKSPACE</span><span>{roleLabels[role]}</span></div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={`${roleLabels[role]} workspace navigation`}>
                <DashboardNavigation role={role} activeSosCount={activeEmergencies.length} />
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="dashboard-sidebar-footer">
          <SidebarSeparator />
          <span className="sidebar-status"><span className="status-dot" /> {localPreview ? 'Local-only preview' : 'Authenticated workspace'}</span>
          {signOutError && <span role="alert">{signOutError}</span>}
          <button className="sidebar-switch" type="button" onClick={handleSignOut}>Sign out <LogOut size={14} aria-hidden="true" /></button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-leading">
            <SidebarTrigger className="mobile-sidebar-trigger" />
            <Brand className="mobile-brand" />
            <span className="topbar-context">FLOOD RESPONSE PLATFORM <span>/</span> {roleLabels[role].toUpperCase()}</span>
          </div>
          {role === 'helper' ? (
            activeEmergencies.length > 0 ? (
              <Button asChild className="button button-small" variant="destructive" size="sm" style={{ background: '#93000a', borderColor: '#ffb4ab', color: '#ffffff' }}>
                <Link to="/helper/sanket">
                  <Siren size={14} aria-hidden="true" />
                  <span>● {activeEmergencies.length} ACTIVE SOS</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="button button-small button-outline topbar-sos" variant="outline" size="sm">
                <Link to="/helper/sanket">Emergency Queue <ArrowUpRight size={14} aria-hidden="true" /></Link>
              </Button>
            )
          ) : (
            <Button asChild className="button button-small button-outline topbar-sos" variant="destructive" size="sm">
              <Link to={role === 'victim' ? '/victim/dashboard' : '/'}>Emergency SOS <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </Button>
          )}
        </header>

        <div className={wide ? 'dashboard-content dashboard-content-wide' : 'dashboard-content'}>
          {/* Real-time Global Emergency Alert Ribbon for Helpers across ALL modules */}
          {role === 'helper' && activeEmergencies.length > 0 && (
            <div
              role="region"
              aria-label="Active Emergency SOS Beacons"
              style={{
                background: 'linear-gradient(135deg, rgba(147, 0, 10, 0.95) 0%, rgba(55, 6, 9, 0.98) 100%)',
                border: '1.5px solid #ffb4ab',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                boxShadow: '0 8px 32px rgba(147, 0, 10, 0.5), inset 0 0 16px rgba(255, 180, 171, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* Alert Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 12px #ffdad6',
                      flexShrink: 0,
                    }}
                  >
                    <Siren size={18} style={{ color: '#93000a' }} aria-hidden="true" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#ffdad6', textTransform: 'uppercase' }}>
                        PRIORITY-1 EMERGENCY DISPATCH: LIVE SOS BEACON ACTIVE
                      </span>
                      <span style={{ background: '#04110a', color: '#ffb4ab', border: '1px solid #ffb4ab', fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                        {activeEmergencies.length} ACTIVE INCIDENT{activeEmergencies.length > 1 ? 'S' : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#ffdad6', opacity: 0.9 }}>
                      Citizen emergency distress beacon received. Field responder actions available below:
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#ffb4ab', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '4px' }}>
                    LIVE GPS LOCK ACTIVE
                  </span>
                </div>
              </div>

              {/* Dispatch Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeEmergencies.map((dispatch) => {
                  const lat = dispatch.location.latitude ?? 13.3408
                  const lon = dispatch.location.longitude ?? 74.7421
                  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
                  return (
                    <div
                      key={dispatch.id}
                      style={{
                        background: 'rgba(4, 17, 10, 0.85)',
                        border: '1px solid rgba(255, 180, 171, 0.3)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--paper)', fontSize: '13px' }}>{dispatch.reporter.name}</strong>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-sky)' }}>#{dispatch.reportId}</span>
                          <span style={{ background: 'rgba(239, 143, 143, 0.25)', color: 'var(--accent-coral)', fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {dispatch.threat}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--sage)' }}>
                            {new Date(dispatch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--sage)' }}>
                          <strong>Location:</strong> {dispatch.location.locality || 'Locality unverified'}, {dispatch.location.taluk} · <strong>Summary:</strong> {dispatch.summary}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)', flexWrap: 'wrap', marginTop: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <LocateFixed size={12} />
                            GPS: {lat.toFixed(4)}° N, {lon.toFixed(4)}° E
                          </span>
                          {dispatch.reporter.phone && (
                            <span style={{ color: 'var(--sage)' }}>
                              TEL: {dispatch.reporter.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <Link
                          to={`/helper/sanket?track=${dispatch.reportId}`}
                          style={{
                            background: 'var(--tactical)',
                            color: '#04110a',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <LocateFixed size={13} />
                          TRACK IN SANKET
                        </Link>

                        <Link
                          to="/helper/drishti"
                          style={{
                            background: 'rgba(158, 213, 132, 0.15)',
                            border: '1px solid var(--tactical)',
                            color: 'var(--tactical)',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          DRISHTI RADAR
                        </Link>

                        <Link
                          to={`/helper/sena?incident=${dispatch.reportId}`}
                          style={{
                            background: 'rgba(245, 189, 88, 0.15)',
                            border: '1px solid var(--accent-amber)',
                            color: 'var(--accent-amber)',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          SENA MOBILIZE
                        </Link>

                        <a
                          href={navUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: 'rgba(123, 208, 255, 0.15)',
                            border: '1px solid var(--accent-sky)',
                            color: 'var(--accent-sky)',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <Navigation size={13} />
                          GPS NAV
                        </a>

                        {dispatch.reporter.phone && (
                          <a
                            href={`tel:${dispatch.reporter.phone}`}
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: 'var(--paper)',
                              textDecoration: 'none',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '6px 12px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <PhoneCall size={13} />
                            CALL
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAcknowledge(dispatch.id)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.12)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={13} />
                          ACKNOWLEDGE
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!hidePageHeader && <PageHeader eyebrow={eyebrow ?? `${roleLabels[role].toUpperCase()} WORKSPACE`} title={title} description={description} />}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout
