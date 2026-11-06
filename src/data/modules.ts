import { Brain, Eye, HeartHandshake, Radio, Users } from 'lucide-react'
import type { ModuleDefinition, WorkspaceRole } from '../types/domain'

export const modulesByRole: Record<WorkspaceRole, ModuleDefinition[]> = {
  victim: [
    {
      id: 'drishti',
      name: 'DRISHTI',
      summary: 'Weather, flood situation, official alerts and preparedness.',
      purpose: 'A place for verified environmental information and practical preparedness guidance.',
      path: '/victim/drishti',
      icon: Eye,
    },
    {
      id: 'sanket',
      name: 'SANKET',
      summary: 'SOS, citizen reports, location and assistance requests.',
      purpose: 'A structured way to prepare an assistance request and share a situation report.',
      path: '/victim/sanket',
      icon: Radio,
    },
    {
      id: 'punarjeev',
      name: 'PUNARJEEV',
      summary: 'Relief and recovery assistance.',
      purpose: 'A future home for recovery resources and relief coordination.',
      path: '/victim/punarjeev',
      icon: HeartHandshake,
    },
  ],
  helper: [
    {
      id: 'drishti',
      name: 'DRISHTI',
      summary: 'Environmental information and situation monitoring.',
      purpose: 'A future view of environmental context and verified situation information.',
      path: '/helper/drishti',
      icon: Eye,
    },
    {
      id: 'sanket',
      name: 'SANKET',
      summary: 'Citizen reports and assistance intake.',
      purpose: 'A future helper-side queue for reviewing citizen reports and triaging assistance needs.',
      path: '/helper/sanket',
      icon: Radio,
    },
    {
      id: 'medha',
      name: 'MEDHA',
      summary: 'Incident analysis, geographic clustering and duplicate detection.',
      purpose: 'Review SANKET incidents, compare possible duplicates, and prepare verified reports for response coordination.',
      path: '/helper/medha',
      icon: Brain,
    },
    {
      id: 'sena',
      name: 'SENA',
      summary: 'Incident review and response coordination.',
      purpose: 'A future coordination workspace for reviewing reports and organizing response.',
      path: '/helper/sena',
      icon: Users,
    },
    {
      id: 'punarjeev',
      name: 'PUNARJEEV',
      summary: 'Relief and recovery coordination.',
      purpose: 'A future workspace for coordinating relief resources and recovery support.',
      path: '/helper/punarjeev',
      icon: HeartHandshake,
    },
  ],
}

export const roleLabels: Record<WorkspaceRole, string> = {
  victim: 'Victim',
  helper: 'Helper',
}