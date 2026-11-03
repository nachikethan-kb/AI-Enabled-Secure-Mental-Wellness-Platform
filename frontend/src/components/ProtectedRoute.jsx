import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role') || 'patient';

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Check role-based access
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      navigate('/dashboard', { replace: true });
      return;
    }

    setIsAuthorized(true);
    setIsLoading(false);
  }, [token, navigate, role, allowedRoles]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1s infinite' }}>⏳</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return children;
}
