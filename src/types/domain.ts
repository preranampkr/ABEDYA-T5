export type WorkspaceRole = 'victim' | 'helper'
export type UserRole = WorkspaceRole | 'admin'
export type AuthMode = 'login' | 'signup' | 'password-reset' | 'update-password'

export interface ModuleDefinition {
  id: string
  name: string
  summary: string
  purpose: string
  path: string
  icon: import('lucide-react').LucideIcon
}