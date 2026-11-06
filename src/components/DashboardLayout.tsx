import { ArrowUpRight, LayoutDashboard, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { disableLocalPreview, isLocalPreviewEnabled } from '../lib/localPreview'
import { modulesByRole, roleLabels } from '../data/modules'
import type { WorkspaceRole } from '../types/domain'
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

function DashboardNavigation({ role }: { role: WorkspaceRole }) {
  const { pathname } = useLocation()
  const dashboardPath = `/${role}/dashboard`

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === dashboardPath}>
          <NavLink to={dashboardPath} end>
            <LayoutDashboard aria-hidden="true" /> <span>Overview</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {modulesByRole[role].map((module) => {
        const Icon = module.icon
        return (
          <SidebarMenuItem key={module.id}>
            <SidebarMenuButton asChild isActive={pathname === module.path}>
              <NavLink to={module.path}>
                <Icon aria-hidden="true" /> <span>{module.name}</span>
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
                <DashboardNavigation role={role} />
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
          <Button asChild className="button button-small button-outline topbar-sos" variant="outline" size="sm">
            <Link to="/">Emergency SOS <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </Button>
        </header>
        <div className={wide ? 'dashboard-content dashboard-content-wide' : 'dashboard-content'}>
          {!hidePageHeader && <PageHeader eyebrow={eyebrow ?? `${roleLabels[role].toUpperCase()} WORKSPACE`} title={title} description={description} />}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout