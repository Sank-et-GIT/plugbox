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
import AdminVendors from './pages/AdminVendors';
import AdminChargers from './pages/AdminChargers';
import AdminUsers from './pages/AdminUsers';
import Vendors from './pages/Vendors';
import Chargers from './pages/Chargers';
import ChargerList from './pages/ChargerList';
import AddCharger from './pages/AddCharger';
import EditCharger from './pages/EditCharger';
import Users from './pages/Users';
import Sessions from './pages/Sessions';
import Payments from './pages/Payments';
import Payouts from './pages/Payouts';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';
import RealTimeDashboard from './pages/RealTimeDashboard';

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
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!['admin', 'super_admin'].includes(user?.role)) {
    // If user is a vendor, redirect to vendor chargers
    if (user?.role === 'vendor') {
      return <Navigate to="/vendor/chargers" replace />;
    }
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

  // Redirect based on user role
  if (user.role === 'vendor') {
    return <Navigate to="/vendor/chargers" replace />;
  } else if (['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  // Default fallback
  return <Navigate to="/login" replace />;
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
            {/* Admin Dashboard */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            {/* Vendor Dashboard - Only Chargers and Earnings */}
            <Route path="/vendor/chargers" element={
              <ProtectedRoute>
                <VendorRoute>
                  <Layout>
                    <ChargerList />
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
            {/* Real-Time Dashboard */}
            <Route path="/realtime" element={
              <ProtectedRoute>
                <Layout>
                  <RealTimeDashboard />
                </Layout>
              </ProtectedRoute>
            } />
            {/* Admin-only routes */}
            <Route path="/admin/vendors" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <AdminVendors />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/chargers" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <AdminChargers />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <AdminUsers />
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            } />
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
