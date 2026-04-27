import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap non-finance routes — redirects accountant away to /admin/fees
export default function AccountantRoute({ children }) {
  const { user } = useAuth();

  if (user?.role === 'accountant') return <Navigate to="/admin/fees" replace />;

  return children;
}
