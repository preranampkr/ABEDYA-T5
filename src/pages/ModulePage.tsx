import { lazy, Suspense } from 'react'
import { ArrowLeft, Construction, Info } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import StatusIndicator from '../components/StatusIndicator'
import { modulesByRole } from '../data/modules'
import type { WorkspaceRole } from '../types/domain'

const DrishtiPage = lazy(() => import('../features/drishti/DrishtiPage'))
const SanketPage = lazy(() => import('../features/sanket/SanketPage'))
const MedhaPage = lazy(() => import('../features/medha/MedhaPage'))
const SenaPage = lazy(() => import('../features/sena/SenaPage'))

interface ModulePageProps {
  role: WorkspaceRole
  moduleId: string
}

function ModulePage({ role, moduleId }: ModulePageProps) {
  const module = modulesByRole[role].find((item) => item.id === moduleId)

  if (!module) return <Navigate to={`/${role}/dashboard`} replace />
  if (moduleId === 'drishti') {
    return (
      <Suspense fallback={<div className="drishti-loading" role="status">Loading DRISHTI geospatial workspace…</div>}>
        <DrishtiPage role={role} />
      </Suspense>
    )
  }

  if (moduleId === 'sanket') {
    return (
      <Suspense fallback={<div className="drishti-loading" role="status">Loading SANKET reporting workspace…</div>}>
        <SanketPage role={role} />
      </Suspense>
    )
  }

  if (moduleId === 'medha') {
    return (
      <Suspense fallback={<div className="drishti-loading" role="status">Loading MEDHA incident intelligence…</div>}>
        <MedhaPage />
      </Suspense>
    )
  }

  if (moduleId === 'sena') {
    return (
      <Suspense fallback={<div className="drishti-loading" role="status">Loading SENA response coordination…</div>}>
        <SenaPage />
      </Suspense>
    )
  }

  const Icon = module.icon

  return (
    <DashboardLayout
      role={role}
      title={module.name}
      description={module.summary}
      eyebrow={`${role.toUpperCase()} MODULE / ${module.id.toUpperCase()}`}
    >
      <section className="module-preview-panel">
        <div className="module-preview-topline">
          <StatusIndicator tone="warning">DEVELOPMENT PREVIEW</StatusIndicator>
          <span className="module-preview-code">{module.id.toUpperCase()} / 00</span>
        </div>
        <div className="module-preview-body">
          <div className="module-preview-icon"><Icon size={25} aria-hidden="true" /></div>
          <div>
            <p className="eyebrow">MODULE FOUNDATION</p>
            <h2>{module.name} is under development</h2>
            <p className="module-purpose">{module.purpose}</p>
          </div>
        </div>
        <div className="module-preview-footer">
          <div><Construction size={16} aria-hidden="true" /><span>Placeholder only · No module functionality is connected</span></div>
          <div><Info size={16} aria-hidden="true" /><span>No live or demonstration operational data is shown here</span></div>
        </div>
        <Link className="text-action" to={`/${role}/dashboard`}><ArrowLeft size={15} aria-hidden="true" /> Return to workspace overview</Link>
      </section>
    </DashboardLayout>
  )
}

export default ModulePage