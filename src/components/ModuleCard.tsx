import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ModuleDefinition } from '../types/domain'

interface ModuleCardProps {
  module: ModuleDefinition
}

function ModuleCard({ module }: ModuleCardProps) {
  const Icon = module.icon

  return (
    <Link className="module-card" to={module.path}>
      <span className="module-card-icon" aria-hidden="true"><Icon size={20} /></span>
      <span className="module-card-copy">
        <span className="module-card-name">{module.name}</span>
        <span className="module-card-summary">{module.summary}</span>
      </span>
      <ArrowUpRight className="module-card-arrow" size={18} aria-hidden="true" />
    </Link>
  )
}

export default ModuleCard