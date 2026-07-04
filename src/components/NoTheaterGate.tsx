import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useCreateTheater } from '../hooks/useCreateTheater';
import { Button } from './Button';
import { WelcomeOnboardingModal } from './WelcomeOnboardingModal';
import { appPaths } from '../navigation/appPaths';

const welcomeStorageKey = (userId: string) => `rehearsals-welcome-seen:${userId}`;

function NoTheaterAccess() {
  const { user, logout, refreshSession } = useAuth();
  const { retryConnection } = useRehearsalStore();
  const { createTheater } = useCreateTheater();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const seen = localStorage.getItem(welcomeStorageKey(user.id));
    if (!seen) {
      setWelcomeOpen(true);
    }
  }, [user?.id]);

  const markWelcomeSeen = () => {
    if (user?.id) {
      localStorage.setItem(welcomeStorageKey(user.id), '1');
    }
    setWelcomeOpen(false);
  };

  const checkAccess = () => {
    void refreshSession().then(() => retryConnection());
  };

  return (
    <>
      <WelcomeOnboardingModal
        open={welcomeOpen}
        onClose={markWelcomeSeen}
        onCreateTheater={createTheater}
      />
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-white">Добро пожаловать</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          У аккаунта <span className="text-foreground">{user?.email}</span> пока нет театров. Создайте
          свой коллектив или дождитесь приглашения — владелец добавит вас в настройках «Доступ к
          театру» с тем же email.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => void createTheater()}>Создать театр</Button>
          <Button variant="secondary" onClick={checkAccess}>
            Проверить доступ
          </Button>
          <Button variant="secondary" onClick={() => void logout()}>
            Выйти
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setWelcomeOpen(true)}
          className="mt-4 text-sm text-gold-light underline-offset-2 hover:underline"
        >
          Показать подсказку снова
        </button>
      </div>
    </>
  );
}

export function NoTheaterGate() {
  const { theaters } = useAuth();
  const { ready, loadError } = useRehearsalStore();
  const location = useLocation();

  const bypassWithoutTheater =
    location.pathname === appPaths.support || location.pathname.startsWith(`${appPaths.admin}/`);

  if (ready && !loadError && theaters.length === 0 && !bypassWithoutTheater) {
    return <NoTheaterAccess />;
  }

  return <Outlet />;
}
