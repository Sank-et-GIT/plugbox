import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const VendorRoute = ({ children }) => {
  const { user } = useAuth();
  
  if (!['vendor'].includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default VendorRoute;
