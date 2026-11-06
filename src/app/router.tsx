import { createBrowserRouter } from 'react-router-dom'
import RequireRole from '../components/RequireRole'
import {
  AdminUsersPage,
  AuthPage,
  DashboardPage,
  LandingPage,
  ModulePage,
  NotFoundPage,
  RoleSelectionPage,
} from './routePages'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  { path: '/roles', element: <RoleSelectionPage /> },
  { path: '/victim/login', element: <AuthPage role="victim" mode="login" /> },
  { path: '/victim/signup', element: <AuthPage role="victim" mode="signup" /> },
  { path: '/victim/password-reset', element: <AuthPage role="victim" mode="password-reset" /> },
  { path: '/helper/login', element: <AuthPage role="helper" mode="login" /> },
  { path: '/helper/signup', element: <AuthPage role="helper" mode="signup" /> },
  { path: '/helper/password-reset', element: <AuthPage role="helper" mode="password-reset" /> },
  { path: '/auth/update-password', element: <AuthPage role="victim" mode="update-password" /> },
  { path: '/victim/dashboard', element: <RequireRole role="victim"><DashboardPage role="victim" /></RequireRole> },
  { path: '/helper/dashboard', element: <RequireRole role="helper"><DashboardPage role="helper" /></RequireRole> },
  { path: '/victim/drishti', element: <RequireRole role="victim"><ModulePage role="victim" moduleId="drishti" /></RequireRole> },
  { path: '/victim/sanket', element: <RequireRole role="victim"><ModulePage role="victim" moduleId="sanket" /></RequireRole> },
  { path: '/victim/punarjeev', element: <RequireRole role="victim"><ModulePage role="victim" moduleId="punarjeev" /></RequireRole> },
  { path: '/helper/drishti', element: <RequireRole role="helper"><ModulePage role="helper" moduleId="drishti" /></RequireRole> },
  { path: '/helper/sanket', element: <RequireRole role="helper"><ModulePage role="helper" moduleId="sanket" /></RequireRole> },
  { path: '/helper/medha', element: <RequireRole role="helper"><ModulePage role="helper" moduleId="medha" /></RequireRole> },
  { path: '/helper/sena', element: <RequireRole role="helper"><ModulePage role="helper" moduleId="sena" /></RequireRole> },
  { path: '/helper/punarjeev', element: <RequireRole role="helper"><ModulePage role="helper" moduleId="punarjeev" /></RequireRole> },
  { path: '/admin/users', element: <RequireRole role="admin"><AdminUsersPage /></RequireRole> },
  { path: '*', element: <NotFoundPage /> },
])