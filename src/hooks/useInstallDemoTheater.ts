import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { buildDemoTheaterBundle } from '../data/demoTheater';
import { appPaths } from '../navigation/appPaths';
export function useInstallDemoTheater() {
  const { dispatch, state } = useRehearsalStore();
  const { grantTheaterAccess, canCreateTheater: canCreateTheaterRole } = useAuth();
  const { alert } = useConfirmDialog();
  const navigate = useNavigate();

  const hasDemo = state.theaters.some((theater) => theater.isDemo);

  const installDemoTheater = async (): Promise<boolean> => {
    if (!canCreateTheaterRole) {
      await alert({
        title: 'Доступ актёра',
        message: 'Пример доступен режиссёру или владельцу. Попросите приглашение в театр.',
        okLabel: 'Понятно',
      });
      return false;
    }

    if (hasDemo) {
      const existing = state.theaters.find((theater) => theater.isDemo);
      if (existing) {
        dispatch({ type: 'SET_ACTIVE_THEATER', payload: existing.id });
        const demoPlay = state.plays.find((play) => play.theaterId === existing.id);
        if (demoPlay) dispatch({ type: 'SET_ACTIVE_PLAY', payload: demoPlay.id });
        const demoRehearsal = state.rehearsals.find((r) => r.theaterId === existing.id);
        if (demoRehearsal) {
          navigate(`${appPaths.rehearsal(demoRehearsal.id)}?share=telegram`);
          return true;
        }
      }
    }

    const bundle = buildDemoTheaterBundle();
    grantTheaterAccess(bundle.theater.id, 'owner');
    dispatch({ type: 'INSTALL_DEMO_THEATER', payload: bundle });
    navigate(`${appPaths.rehearsal(bundle.rehearsal.id)}?share=telegram`);
    return true;
  };

  return { installDemoTheater, hasDemo };
}
