import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LoginPage } from '../pages/LoginPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { ErrorPage } from '../pages/ErrorPage';
import { LoadingState } from '../components/LoadingState';

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const EmailsPage = lazy(() => import('../pages/EmailsPage').then((module) => ({ default: module.EmailsPage })));
const EmailDetailPage = lazy(() => import('../pages/EmailDetailPage').then((module) => ({ default: module.EmailDetailPage })));
const CalendarPage = lazy(() => import('../pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const TasksPage = lazy(() => import('../pages/TasksPage').then((module) => ({ default: module.TasksPage })));
const AssistantPage = lazy(() => import('../pages/AssistantPage').then((module) => ({ default: module.AssistantPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading page" />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />
          <Route path="/emails" element={<LazyPage><EmailsPage /></LazyPage>} />
          <Route path="/emails/:id" element={<LazyPage><EmailDetailPage /></LazyPage>} />
          <Route path="/calendar" element={<LazyPage><CalendarPage /></LazyPage>} />
          <Route path="/tasks" element={<LazyPage><TasksPage /></LazyPage>} />
          <Route path="/assistant" element={<LazyPage><AssistantPage /></LazyPage>} />
          <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />
        </Route>
      </Route>
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  );
}
