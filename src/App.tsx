import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { GoogleDocsAuthProvider } from './store/GoogleDocsAuthContext';
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
import { GuidePage } from './pages/GuidePage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminStatsPage } from './pages/AdminStatsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminUserDetailPage } from './pages/AdminUserDetailPage';
import { MarketingPage } from './pages/MarketingPage';
import { PricingPage } from './pages/PricingPage';
import { LoginPage } from './pages/LoginPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { TermsPage } from './pages/legal/TermsPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { OfferPage } from './pages/legal/OfferPage';
import { AdminRoute } from './components/AdminRoute';
import { ScrollToTop } from './components/ScrollToTop';
import { appPaths } from './navigation/appPaths';

function LegacyRehearsalRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? appPaths.rehearsal(id) : appPaths.rehearsals} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmDialogProvider>
        <BrowserRouter>
          <DesignProvider>
            <ScrollToTop />
            <Routes>
              <Route index element={<MarketingPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="verify-email" element={<VerifyEmailPage />} />
              <Route path="legal/terms" element={<TermsPage />} />
              <Route path="legal/privacy" element={<PrivacyPage />} />
              <Route path="legal/offer" element={<OfferPage />} />
              <Route path="welcome" element={<Navigate to="/" replace />} />
              <Route path="actors" element={<Navigate to="/app/actors" replace />} />
              <Route path="play" element={<Navigate to="/app/play" replace />} />
              <Route path="scenes" element={<Navigate to="/app/scenes" replace />} />
              <Route path="tasks" element={<Navigate to="/app/tasks" replace />} />
              <Route path="venues" element={<Navigate to="/app/venues" replace />} />
              <Route path="rehearsals" element={<Navigate to="/app/rehearsals" replace />} />
              <Route path="rehearsals/:id" element={<LegacyRehearsalRedirect />} />
              <Route path="settings" element={<Navigate to="/app/settings" replace />} />
              <Route path="guide" element={<Navigate to="/app/guide" replace />} />
              <Route
                path="app"
                element={
                  <ProtectedRoute>
                    <GoogleDocsAuthProvider>
                      <RehearsalProvider>
                        <Layout />
                      </RehearsalProvider>
                    </GoogleDocsAuthProvider>
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
                <Route path="guide" element={<GuidePage />} />
                <Route
                  path="admin"
                  element={
                    <AdminRoute>
                      <AdminStatsPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="admin/users"
                  element={
                    <AdminRoute>
                      <AdminUsersPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="admin/users/:userId"
                  element={
                    <AdminRoute>
                      <AdminUserDetailPage />
                    </AdminRoute>
                  }
                />
              </Route>
            </Routes>
          </DesignProvider>
        </BrowserRouter>
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}
