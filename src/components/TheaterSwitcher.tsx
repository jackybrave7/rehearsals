import { Building2, Check, ChevronDown, Pencil, Plus } from 'lucide-react';
import { DeleteButton } from './DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useAuth } from '../store/AuthContext';
import { useConfirmDialog } from './ConfirmDialogContext';
import { getActiveTheater } from '../store/selectors';
import { generateId } from '../utils/id';
import { canCreateTheater } from '../utils/subscription';
import { useSubscription } from '../hooks/useSubscription';

type TheaterSwitcherProps = {
  variant: 'sidebar' | 'zen';
  onTheaterChange?: () => void;
};

export function TheaterSwitcher({ variant, onTheaterChange }: TheaterSwitcherProps) {
  const { state, dispatch } = useRehearsalStore();
  const { grantTheaterAccess, theaters: accessTheaters } = useAuth();
  const { isPro } = useSubscription();
  const { confirmDelete, prompt, alert } = useConfirmDialog();
  const activeTheater = getActiveTheater(state);

  const setActiveTheater = (theaterId: string) => {
    dispatch({ type: 'SET_ACTIVE_THEATER', payload: theaterId });
    onTheaterChange?.();
  };

  const createTheater = async () => {
    const ownedCount = accessTheaters.filter((entry) => entry.role === 'owner').length;
    if (!canCreateTheater(ownedCount, isPro)) {
      await alert({
        title: 'Лимит тарифа Free',
        message:
          'На бесплатном тарифе доступен один театр. Перейдите на Pro, чтобы вести несколько коллективов.',
        okLabel: 'Понятно',
      });
      return;
    }
    const name = await prompt({
      title: 'Новый театр',
      message: 'Название театра или коллектива',
      placeholder: 'Например, Libertad',
      confirmLabel: 'Создать',
    });
    if (!name) return;
    const id = generateId();
    grantTheaterAccess(id, 'owner');
    dispatch({ type: 'ADD_THEATER', payload: { id, name } });
  };

  const renameTheater = async () => {
    if (!activeTheater) return;
    const name = await prompt({
      title: 'Переименовать театр',
      defaultValue: activeTheater.name,
      confirmLabel: 'Сохранить',
    });
    if (!name) return;
    dispatch({ type: 'UPDATE_THEATER', payload: { ...activeTheater, name } });
  };

  const deleteTheater = async () => {
    if (!activeTheater || state.theaters.length <= 1) return;
    const confirmed = await confirmDelete({
      title: `Удалить театр «${activeTheater.name}»?`,
      message:
        'Все данные этого театра — постановки, сцены, репетиции и участники — будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить театр',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_THEATER', payload: activeTheater.id });
  };

  if (variant === 'sidebar') {
    return (
      <div className="mb-4 rounded-xl border border-gold/10 bg-background/30 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <Building2 size={14} />
          Театр
        </div>
        <select
          value={state.activeTheaterId ?? ''}
          onChange={(event) => setActiveTheater(event.target.value)}
          className="w-full rounded-lg border border-gold/10 bg-surface px-2 py-2 text-sm text-white outline-none transition-colors focus:border-gold/30"
        >
          {state.theaters.map((theater) => (
            <option key={theater.id} value={theater.id}>
              {theater.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            onClick={createTheater}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gold-light transition-colors hover:bg-gold/10"
          >
            <Plus size={13} /> Новый
          </button>
          <button
            type="button"
            onClick={renameTheater}
            className="rounded-lg px-2 py-1.5 text-muted transition-colors hover:bg-white/5 hover:text-white"
            title="Переименовать"
          >
            <Pencil size={13} />
          </button>
          <DeleteButton
            label="Удалить театр"
            iconSize={13}
            disabled={state.theaters.length <= 1}
            onClick={deleteTheater}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/60 px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
          <Building2 size={14} />
          Театр
        </div>
        <button
          type="button"
          onClick={createTheater}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted transition-colors hover:bg-black/[0.04] hover:text-foreground"
        >
          <Plus size={13} />
          Новый
        </button>
      </div>

      <div className="space-y-1">
        {state.theaters.map((theater) => {
          const selected = theater.id === state.activeTheaterId;
          return (
            <button
              key={theater.id}
              type="button"
              onClick={() => setActiveTheater(theater.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-base transition-all ${
                selected
                  ? 'zen-nav-link-active font-semibold'
                  : 'text-muted hover:bg-black/[0.03] hover:text-foreground'
              }`}
            >
              <span className="truncate">{theater.name}</span>
              {selected && <Check size={16} className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>

      {activeTheater && (
        <div className="mt-3 flex gap-1 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={renameTheater}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs text-muted transition-colors hover:bg-black/[0.03] hover:text-foreground"
          >
            <Pencil size={13} />
            Переименовать
          </button>
          <DeleteButton
            label={`Удалить театр «${activeTheater.name}»`}
            iconSize={13}
            disabled={state.theaters.length <= 1}
            onClick={deleteTheater}
          />
        </div>
      )}
    </div>
  );
}

export function ZenTheaterTrigger({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  const { state } = useRehearsalStore();
  const activeTheater = getActiveTheater(state);

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? 'group flex max-w-[11rem] shrink-0 items-center gap-1 truncate text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground sm:max-w-[13rem]'
          : 'group flex max-w-full items-center gap-1.5 truncate text-left text-sm font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-foreground'
      }
      aria-label="Сменить театр"
    >
      <span className="truncate">{activeTheater?.name ?? 'Выберите театр'}</span>
      <ChevronDown
        size={14}
        className="shrink-0 transition-transform duration-200 group-hover:translate-y-0.5"
      />
    </button>
  );
}
