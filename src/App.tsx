import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LandingPage from './pages/Landing';
import LoginPage from './pages/Login';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/app/Dashboard';
import Attendance from './pages/app/Attendance';
import Meetings from './pages/app/Meetings';
import Inventory from './pages/app/Inventory';
import LeaveRequests from './pages/app/LeaveRequests';
import Employees from './pages/app/Employees';
import ProfilePage from './pages/app/Profile';
import Reports from './pages/app/Reports';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/app" element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="leave" element={<LeaveRequests />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="reports" element={<Reports />} />
            
            {/* Admin Only Routes */}
            <Route path="employees" element={
              <ProtectedRoute adminOnly>
                <Employees />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
