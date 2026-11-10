import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useRehearsalStore } from '../../store/RehearsalContext';
import { useAuth } from '../../store/AuthContext';
import {
  getNextSetupStep,
  getTheaterSetupProgress,
  isGuideChecklistHidden,
  isOnboardingChecklistSkipped,
} from '../../utils/guideOnboarding';

const SETUP_PATH_PREFIXES = [
  '/app/overview',
  '/app/actors',
  '/app/play',
  '/app/scenes',
  '/app/venues',
  '/app/rehearsals',
  '/app/settings',
];

export function TheaterSetupProgressStrip() {
  const { state } = useRehearsalStore();
  const { canEditTheater } = useAuth();
  const location = useLocation();

  const visible = useMemo(() => {
    if (!canEditTheater(state.activeTheaterId)) return false;
    if (isGuideChecklistHidden() || isOnboardingChecklistSkipped()) return false;
    if (!SETUP_PATH_PREFIXES.some((path) => location.pathname.startsWith(path))) return false;
    const { allDone } = getTheaterSetupProgress(state);
    return !allDone;
  }, [canEditTheater, location.pathname, state]);

  const { completed, total } = useMemo(() => getTheaterSetupProgress(state), [state]);
  const next = useMemo(() => getNextSetupStep(state), [state]);

  if (!visible || !next) return null;

  return (
    <Link
      to={next.href}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/15 bg-surface/50 px-3 py-2 text-sm text-muted transition-colors hover:border-gold/30 hover:bg-surface/70"
    >
      <span className="font-medium text-foreground">
        Выполнено {completed} из {total}
      </span>
      <span className="text-muted">·</span>
      <span className="text-gold-light">
        Дальше: {next.label}
      </span>
      <ChevronRight size={16} className="text-gold" aria-hidden />
    </Link>
  );
}
