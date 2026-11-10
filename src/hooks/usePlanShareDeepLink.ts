import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getTheaterRehearsals } from '../store/selectors';
import { appPaths } from '../navigation/appPaths';

/** Из письма drip: /app/rehearsals?planShare=1 → ближайшая репетиция с планом и окно «Поделиться». */
export function usePlanShareDeepLink() {
  const { state, ready } = useRehearsalStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || searchParams.get('planShare') !== '1') return;

    const today = new Date().toISOString().slice(0, 10);
    const withPlan = getTheaterRehearsals(state)
      .filter((rehearsal) => rehearsal.schedule.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const target =
      withPlan.find((rehearsal) => rehearsal.date >= today) ?? withPlan[withPlan.length - 1];

    const next = new URLSearchParams(searchParams);
    next.delete('planShare');
    setSearchParams(next, { replace: true });

    if (target) {
      navigate(`${appPaths.rehearsal(target.id)}?share=telegram`, { replace: true });
    }
  }, [navigate, ready, searchParams, setSearchParams, state]);
}
