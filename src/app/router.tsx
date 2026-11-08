import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import AdminDashboardPage from '../pages/AdminDashboardPage'
import AdminHelpersPage from '../pages/AdminHelpersPage'
import AuthPage from '../pages/AuthPage'
import DashboardPage from '../pages/DashboardPage'
import LandingPage from '../pages/LandingPage'
import ModulePage from '../pages/ModulePage'
import NotFoundPage from '../pages/NotFoundPage'
import PendingApprovalPage from '../pages/PendingApprovalPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import RoleSelectionPage from '../pages/RoleSelectionPage'

export const router = createBrowserRouter([
  // Public Open Routes
  { path: '/', element: <LandingPage /> },
  { path: '/roles', element: <RoleSelectionPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Authentication Flows
  { path: '/victim/login', element: <AuthPage role="victim" mode="login" /> },
  { path: '/victim/signup', element: <AuthPage role="victim" mode="signup" /> },
  { path: '/helper/login', element: <AuthPage role="helper" mode="login" /> },
  { path: '/helper/signup', element: <AuthPage role="helper" mode="signup" /> },
  { path: '/admin/login', element: <AuthPage role="admin" mode="login" /> },

  // Helper Verification State
  { path: '/helper/pending-approval', element: <PendingApprovalPage /> },

  // Protected Victim Workspaces
  {
    path: '/victim/dashboard',
    element: (
      <ProtectedRoute allowedRole="victim">
        <DashboardPage role="victim" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/victim/drishti',
    element: (
      <ProtectedRoute allowedRole="victim">
        <ModulePage role="victim" moduleId="drishti" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/victim/sanket',
    element: (
      <ProtectedRoute allowedRole="victim">
        <ModulePage role="victim" moduleId="sanket" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/victim/punarjeev',
    element: (
      <ProtectedRoute allowedRole="victim">
        <ModulePage role="victim" moduleId="punarjeev" />
      </ProtectedRoute>
    ),
  },

  // Protected Helper Workspaces (Strict Approval Enforced)
  {
    path: '/helper/dashboard',
    element: (
      <ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>
        <DashboardPage role="helper" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/helper/drishti',
    element: (
      <ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>
        <ModulePage role="helper" moduleId="drishti" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/helper/sanket',
    element: (
      <ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>
        <ModulePage role="helper" moduleId="sanket" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/helper/medha',
    element: (
      <ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>
        <ModulePage role="helper" moduleId="medha" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/helper/sena',
    element: (
      <ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>
        <ModulePage role="helper" moduleId="sena" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/helper/punarjeev',
    element: (
      <ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>
        <ModulePage role="helper" moduleId="punarjeev" />
      </ProtectedRoute>
    ),
  },

  // Protected Admin Workspaces
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedRoute allowedRole="admin">
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/helpers',
    element: (
      <ProtectedRoute allowedRole="admin">
        <AdminHelpersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/sanket',
    element: (
      <ProtectedRoute allowedRole="admin">
        <ModulePage role="admin" moduleId="sanket" />
      </ProtectedRoute>
    ),
  },

  // Catch-all
  { path: '*', element: <NotFoundPage /> },
])
