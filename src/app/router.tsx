import { createBrowserRouter } from 'react-router-dom'
import AuthPage from '../pages/AuthPage'
import DashboardPage from '../pages/DashboardPage'
import LandingPage from '../pages/LandingPage'
import ModulePage from '../pages/ModulePage'
import NotFoundPage from '../pages/NotFoundPage'
import RoleSelectionPage from '../pages/RoleSelectionPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  { path: '/roles', element: <RoleSelectionPage /> },
  { path: '/victim/login', element: <AuthPage role="victim" mode="login" /> },
  { path: '/victim/signup', element: <AuthPage role="victim" mode="signup" /> },
  { path: '/helper/login', element: <AuthPage role="helper" mode="login" /> },
  { path: '/helper/signup', element: <AuthPage role="helper" mode="signup" /> },
  { path: '/victim/dashboard', element: <DashboardPage role="victim" /> },
  { path: '/helper/dashboard', element: <DashboardPage role="helper" /> },
  { path: '/victim/drishti', element: <ModulePage role="victim" moduleId="drishti" /> },
  { path: '/victim/sanket', element: <ModulePage role="victim" moduleId="sanket" /> },
  { path: '/victim/punarjeev', element: <ModulePage role="victim" moduleId="punarjeev" /> },
  { path: '/helper/drishti', element: <ModulePage role="helper" moduleId="drishti" /> },
  { path: '/helper/medha', element: <ModulePage role="helper" moduleId="medha" /> },
  { path: '/helper/sena', element: <ModulePage role="helper" moduleId="sena" /> },
  { path: '/helper/punarjeev', element: <ModulePage role="helper" moduleId="punarjeev" /> },
  { path: '*', element: <NotFoundPage /> },
])