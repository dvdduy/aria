import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ChatPage from '@/pages/ChatPage'
import LeavePage from '@/pages/LeavePage'
import TeamPage from '@/pages/TeamPage'
import PoliciesPage from '@/pages/PoliciesPage'
import PayrollPage from '@/pages/PayrollPage'
import EmployeesPage from '@/pages/EmployeesPage'
import DevLoginPage from '@/pages/DevLoginPage'

export const router = createBrowserRouter(
  [
    ...(import.meta.env.DEV ? [{ path: '/dev', element: <DevLoginPage /> }] : []),
    { path: '/login', element: <LoginPage /> },
    {
      element: <AppLayout />,
      children: [
        { path: '/',           element: <DashboardPage /> },
        { path: '/chat',       element: <ChatPage /> },
        { path: '/leave',      element: <LeavePage /> },
        { path: '/team',       element: <TeamPage /> },
        { path: '/policies',   element: <PoliciesPage /> },
        { path: '/payroll',    element: <PayrollPage /> },
        { path: '/employees',  element: <EmployeesPage /> },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
)
