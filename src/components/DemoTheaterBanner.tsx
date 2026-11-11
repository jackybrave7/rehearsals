import { Sparkles, Trash2 } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveTheater } from '../store/selectors';
import { Button } from './Button';
import { useConfirmDialog } from './ConfirmDialogContext';

export function DemoTheaterBanner() {
  const { state, dispatch, readOnly } = useRehearsalStore();
  const theater = getActiveTheater(state);
  const { confirmDelete } = useConfirmDialog();

  if (!theater?.isDemo || readOnly) return null;

  const handleRemove = async () => {
    const ok = await confirmDelete({
      title: 'Удалить пример?',
      message:
        'Театр-пример «Чайка» и все его демо-данные исчезнут с аккаунта. Ваши театры не затронуты.',
      confirmWord: 'удалить',
    });
    if (!ok) return;
    dispatch({ type: 'DELETE_THEATER', payload: theater.id });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/10 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-white">Это учебный пример</p>
          <p className="text-muted">
            Демо-театр не занимает лимит Free. Создайте свой театр, когда будете готовы.
          </p>
        </div>
      </div>
      <Button type="button" variant="secondary" className="shrink-0" onClick={() => void handleRemove()}>
        <Trash2 size={16} />
        Удалить пример
      </Button>
    </div>
  );
}
