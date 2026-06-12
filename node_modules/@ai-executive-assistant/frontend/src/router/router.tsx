import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LoginPage } from '../pages/LoginPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EmailsPage } from '../pages/EmailsPage';
import { EmailDetailPage } from '../pages/EmailDetailPage';
import { CalendarPage } from '../pages/CalendarPage';
import { TasksPage } from '../pages/TasksPage';
import { AssistantPage } from '../pages/AssistantPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ErrorPage } from '../pages/ErrorPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage />, errorElement: <ErrorPage /> },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/emails', element: <EmailsPage /> },
          { path: '/emails/:id', element: <EmailDetailPage /> },
          { path: '/calendar', element: <CalendarPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/assistant', element: <AssistantPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '*', element: <ErrorPage /> }
        ]
      }
    ]
  },
  { path: '*', element: <ErrorPage /> }
]);
