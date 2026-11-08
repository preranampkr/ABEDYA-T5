export type UserRole = 'victim' | 'helper' | 'admin'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AuthMode = 'login' | 'signup'

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  organization?: string
  approvalStatus: ApprovalStatus
  createdAt?: string
  updatedAt?: string
}

export interface ModuleDefinition {
  id: string
  name: string
  summary: string
  purpose: string
  path: string
  icon: import('lucide-react').LucideIcon
}
