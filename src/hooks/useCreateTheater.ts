import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { useSubscription } from './useSubscription';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { generateId } from '../utils/id';
import { canCreateTheater } from '../utils/subscription';

export function useCreateTheater() {
  const { dispatch } = useRehearsalStore();
  const { grantTheaterAccess, theaters: accessTheaters } = useAuth();
  const { isPro } = useSubscription();
  const { prompt, alert } = useConfirmDialog();

  const createTheater = async (): Promise<boolean> => {
    const ownedCount = accessTheaters.filter((entry) => entry.role === 'owner').length;
    if (!canCreateTheater(ownedCount, isPro)) {
      await alert({
        title: 'Лимит тарифа Free',
        message:
          'На бесплатном тарифе доступен один театр. Перейдите на Pro, чтобы вести несколько коллективов.',
        okLabel: 'Понятно',
      });
      return false;
    }
    const name = await prompt({
      title: 'Новый театр',
      message: 'Название театра или коллектива',
      placeholder: 'Например, Libertad',
      confirmLabel: 'Создать',
    });
    if (!name) return false;
    const id = generateId();
    grantTheaterAccess(id, 'owner');
    dispatch({ type: 'ADD_THEATER', payload: { id, name } });
    return true;
  };

  return { createTheater };
}
