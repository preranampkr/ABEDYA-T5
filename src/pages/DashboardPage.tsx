import { ArrowRight, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import ModuleCard from '../components/ModuleCard'
import StatusIndicator from '../components/StatusIndicator'
import { modulesByRole, roleLabels } from '../data/modules'
import type { UserRole } from '../types/domain'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'

interface DashboardPageProps {
  role: UserRole
}

function DashboardPage({ role }: DashboardPageProps) {
  const roleLabel = roleLabels[role]
  const modules = modulesByRole[role]

  return (
    <DashboardLayout
      role={role}
      title="Workspace overview"
      description={`A focused ${roleLabel.toLowerCase()} view of ABHEDYA's flood response modules.`}
    >
      <Alert className="environment-notice" role="note" aria-label="Prototype environment status">
        <Info size={17} aria-hidden="true" />
        <div><AlertTitle>Demonstration environment</AlertTitle><AlertDescription>No live weather, official alerts, incident reports or response activity are connected.</AlertDescription></div>
        <StatusIndicator tone="warning">PREVIEW</StatusIndicator>
      </Alert>

      <section className="workspace-intro">
        <div>
          <p className="eyebrow">ABHEDYA / {roleLabel.toUpperCase()}</p>
          <h2>{role === 'victim' ? 'Information and assistance' : 'Monitoring and coordination'}</h2>
          <p>{role === 'victim'
            ? 'Explore preparedness information, request assistance or review recovery support modules.'
            : 'Explore the planned tools for situation monitoring, incident review and coordinated support.'}</p>
        </div>
        <Button asChild className="button button-primary">
          <Link to="/">
          <span className="sos-button-dot" /> Emergency SOS <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <section className="module-section" aria-labelledby="module-list-title">
        <div className="section-heading">
          <div><p className="eyebrow">PLATFORM MODULES</p><h2 id="module-list-title">Your workspace</h2></div>
          <span className="section-count">{String(modules.length).padStart(2, '0')} MODULES</span>
        </div>
        <div className="module-grid">
          {modules.map((module) => <ModuleCard key={module.id} module={module} />)}
        </div>
      </section>

      <p className="workspace-disclaimer">Prototype interface · Module pages are development previews and contain no operational data.</p>
    </DashboardLayout>
  )
}

export default DashboardPage