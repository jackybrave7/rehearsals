import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { appPaths } from '../navigation/appPaths';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        Проверка доступа…
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to={appPaths.home} replace />;
  }

  return children;
}
