import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const VendorRoute = ({ children }) => {
  const { user } = useAuth();
  
  // Check if user is authenticated and has vendor role
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role !== 'vendor') {
    // If not a vendor, redirect to admin dashboard
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return children;
};

export default VendorRoute;
