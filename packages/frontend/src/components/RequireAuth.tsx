import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function RequireAuth() {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (accessToken === null) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
