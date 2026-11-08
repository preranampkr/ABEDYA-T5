import { ArrowUpRight, LayoutDashboard, LogOut } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { modulesByRole, roleLabels } from '../data/modules'
import { useAuth } from '../features/auth/AuthContext'
import type { UserRole } from '../types/domain'
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
  role: UserRole
  title: string
  description: string
  eyebrow?: string
  wide?: boolean
  hidePageHeader?: boolean
  children: React.ReactNode
}

function DashboardNavigation({ role }: { role: UserRole }) {
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
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/roles')
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
          {profile && (
            <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--slate-10, #94a3b8)' }}>
              Signed in as <strong style={{ color: 'var(--slate-12, #f8fafc)' }}>{profile.fullName}</strong>
            </div>
          )}
          <span className="sidebar-status"><span className="status-dot" /> Prototype environment</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
            <Link className="sidebar-switch" to="/roles">Switch role <ArrowUpRight size={14} aria-hidden="true" /></Link>
            {profile && (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 4px',
                }}
              >
                <LogOut size={12} /> Sign out
              </button>
            )}
          </div>
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
        <main className={wide ? 'dashboard-content dashboard-content-wide' : 'dashboard-content'}>
          {!hidePageHeader && <PageHeader eyebrow={eyebrow ?? `${roleLabels[role].toUpperCase()} WORKSPACE`} title={title} description={description} />}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout