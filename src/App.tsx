import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { RehearsalProvider } from './store/RehearsalContext';
import { DesignProvider } from './store/DesignContext';
import { ConfirmDialogProvider } from './components/ConfirmDialogContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { OverviewPage } from './pages/OverviewPage';
import { ActorsPage } from './pages/ActorsPage';
import { ActorDetailPage } from './pages/ActorDetailPage';
import { PlayPage } from './pages/PlayPage';
import { ScenesPage } from './pages/ScenesPage';
import { TasksPage } from './pages/TasksPage';
import { RehearsalsPage } from './pages/RehearsalsPage';
import { RehearsalDetailPage } from './pages/RehearsalDetailPage';
import { VenuesPage } from './pages/VenuesPage';
import { SettingsPage } from './pages/SettingsPage';
import { MarketingPage } from './pages/MarketingPage';
import { LoginPage } from './pages/LoginPage';
import { appPaths } from './navigation/appPaths';

function LegacyRehearsalRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? appPaths.rehearsal(id) : appPaths.rehearsals} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <DesignProvider>
        <ConfirmDialogProvider>
          <BrowserRouter>
            <Routes>
              <Route index element={<MarketingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="welcome" element={<Navigate to="/" replace />} />
              <Route path="actors" element={<Navigate to="/app/actors" replace />} />
              <Route path="play" element={<Navigate to="/app/play" replace />} />
              <Route path="scenes" element={<Navigate to="/app/scenes" replace />} />
              <Route path="tasks" element={<Navigate to="/app/tasks" replace />} />
              <Route path="venues" element={<Navigate to="/app/venues" replace />} />
              <Route path="rehearsals" element={<Navigate to="/app/rehearsals" replace />} />
              <Route path="rehearsals/:id" element={<LegacyRehearsalRedirect />} />
              <Route path="settings" element={<Navigate to="/app/settings" replace />} />
              <Route
                path="app"
                element={
                  <ProtectedRoute>
                    <RehearsalProvider>
                      <Layout />
                    </RehearsalProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="actors" element={<ActorsPage />} />
                <Route path="actors/:id" element={<ActorDetailPage />} />
                <Route path="play" element={<PlayPage />} />
                <Route path="scenes" element={<ScenesPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="venues" element={<VenuesPage />} />
                <Route path="rehearsals" element={<RehearsalsPage />} />
                <Route path="rehearsals/:id" element={<RehearsalDetailPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ConfirmDialogProvider>
      </DesignProvider>
    </AuthProvider>
  );
}
