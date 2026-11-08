import { ArrowRight, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import ModuleCard from '../components/ModuleCard'
import StatusIndicator from '../components/StatusIndicator'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { modulesByRole } from '../data/modules'

export function AdminDashboardPage() {
  const adminModules = modulesByRole.admin

  return (
    <DashboardLayout
      role="admin"
      title="District Administration Command"
      description="Administrative oversight, helper authorization, and platform-wide disaster monitoring for Udupi District."
      eyebrow="DISTRICT ADMINISTRATION"
    >
      <Alert className="environment-notice" role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <AlertTitle>Administrative Command Access</AlertTitle>
          <AlertDescription>
            You are operating with platform administrative privileges. You can review and authorize emergency helpers, audit incident response dispatches, and oversee district-wide situational reports.
          </AlertDescription>
        </div>
        <StatusIndicator tone="neutral">ADMIN SECURE</StatusIndicator>
      </Alert>

      <section className="workspace-intro">
        <div>
          <p className="eyebrow">ABHEDYA / DISTRICT COMMISSIONER & DISASTER CELL</p>
          <h2>Platform oversight & coordination</h2>
          <p>
            Verify volunteer responders and rescue organisations, review pending SANKET emergency alerts, and coordinate disaster intelligence across Udupi district taluks.
          </p>
        </div>
        <Button asChild className="button button-primary">
          <Link to="/admin/helpers">
            <Users size={16} aria-hidden="true" /> Review Helper Applications <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <section className="module-section" aria-labelledby="admin-module-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ADMINISTRATIVE MODULES</p>
            <h2 id="admin-module-title">Command workspace</h2>
          </div>
          <span className="section-count">{String(adminModules.length).padStart(2, '0')} MODULES</span>
        </div>
        <div className="module-grid">
          {adminModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </section>
    </DashboardLayout>
  )
}

export default AdminDashboardPage
