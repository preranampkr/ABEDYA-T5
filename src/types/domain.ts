export type UserRole = 'victim' | 'helper'
export type AuthMode = 'login' | 'signup'

export interface ModuleDefinition {
  id: string
  name: string
  summary: string
  purpose: string
  path: string
  icon: import('lucide-react').LucideIcon
}