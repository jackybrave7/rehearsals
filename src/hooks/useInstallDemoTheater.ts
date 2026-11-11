import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { buildDemoTheaterBundle } from '../data/demoTheater';
import { findDemoTheater, isDemoTheater } from '../utils/demoTheaterIdentity';
import { appPaths } from '../navigation/appPaths';

export function useInstallDemoTheater() {
  const { dispatch, state } = useRehearsalStore();
  const { grantTheaterAccess, canCreateTheater: canCreateTheaterRole } = useAuth();
  const { alert } = useConfirmDialog();
  const navigate = useNavigate();
  const installInFlightRef = useRef(false);

  const hasDemo = state.theaters.some(isDemoTheater);

  const focusDemoTheater = useCallback(
    (theaterId: string) => {
      dispatch({ type: 'SET_ACTIVE_THEATER', payload: theaterId });
      const demoPlay = state.plays.find((play) => play.theaterId === theaterId);
      if (demoPlay) dispatch({ type: 'SET_ACTIVE_PLAY', payload: demoPlay.id });
      const demoRehearsal = state.rehearsals.find((r) => r.theaterId === theaterId);
      if (demoRehearsal) {
        navigate(`${appPaths.rehearsal(demoRehearsal.id)}?share=telegram`);
      }
    },
    [dispatch, navigate, state.plays, state.rehearsals]
  );

  const installDemoTheater = useCallback(async (): Promise<boolean> => {
    if (installInFlightRef.current) return false;
    installInFlightRef.current = true;
    try {
      if (!canCreateTheaterRole) {
        await alert({
          title: 'Доступ актёра',
          message: 'Пример доступен режиссёру или владельцу. Попросите приглашение в театр.',
          okLabel: 'Понятно',
        });
        return false;
      }

      const existing = findDemoTheater(state);
      if (existing) {
        focusDemoTheater(existing.id);
        return true;
      }

      const bundle = buildDemoTheaterBundle();
      grantTheaterAccess(bundle.theater.id, 'owner');
      dispatch({ type: 'INSTALL_DEMO_THEATER', payload: bundle });
      navigate(`${appPaths.rehearsal(bundle.rehearsal.id)}?share=telegram`);
      return true;
    } finally {
      installInFlightRef.current = false;
    }
  }, [
    alert,
    canCreateTheaterRole,
    dispatch,
    focusDemoTheater,
    grantTheaterAccess,
    navigate,
    state,
  ]);

  return { installDemoTheater, hasDemo };
}
