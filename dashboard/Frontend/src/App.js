import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import VendorRoute from './components/VendorRoute';
import Vendors from './pages/Vendors';
import Chargers from './pages/Chargers';
import Users from './pages/Users';
import Sessions from './pages/Sessions';
import Payments from './pages/Payments';
import Payouts from './pages/Payouts';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  
  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

function Layout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

function RoleBasedRedirect() {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect based on role
  switch (user.role) {
    case 'admin':
    case 'super_admin':
      return <Navigate to="/" replace />; // Admin dashboard
    case 'vendor':
      return <Navigate to="/vendor/dashboard" replace />; // Vendor dashboard
    default:
      return <Navigate to="/" replace />;
  }
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={
              <ProtectedRoute>
                <RoleBasedRedirect />
              </ProtectedRoute>
            } />
            {/* Vendor Dashboard */}
            <Route path="/vendor/dashboard" element={
              <ProtectedRoute>
                <VendorRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </VendorRoute>
              </ProtectedRoute>
            } />
            <Route path="/vendor/chargers" element={
              <ProtectedRoute>
                <VendorRoute>
                  <Layout>
                    <Chargers />
                  </Layout>
                </VendorRoute>
              </ProtectedRoute>
            } />
            <Route path="/vendor/sessions" element={
              <ProtectedRoute>
                <VendorRoute>
                  <Layout>
                    <Sessions />
                  </Layout>
                </VendorRoute>
              </ProtectedRoute>
            } />
            <Route path="/vendor/earnings" element={
              <ProtectedRoute>
                <VendorRoute>
                  <Layout>
                    <Earnings />
                  </Layout>
                </VendorRoute>
              </ProtectedRoute>
            } />
            <Route path="/vendor/profile" element={
              <ProtectedRoute>
                <VendorRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </VendorRoute>
              </ProtectedRoute>
            } />
            {/* Admin-only routes */}
            <Route path="/vendors" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Vendors />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Users />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Payments />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/payouts" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Payouts />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
