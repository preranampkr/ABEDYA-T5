import { ArrowUpRight, LayoutDashboard } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { modulesByRole, roleLabels } from '../data/modules'
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
          <span className="sidebar-status"><span className="status-dot" /> Prototype environment</span>
          <Link className="sidebar-switch" to="/roles">Switch role <ArrowUpRight size={14} aria-hidden="true" /></Link>
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