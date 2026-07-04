import { useState } from 'react';
import { Building2, Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useConfirmDialog } from './ConfirmDialogContext';
import { getActiveTheater } from '../store/selectors';
import { useCreateTheater } from '../hooks/useCreateTheater';
import {
  TheaterItemMenu,
  useTheaterRowLongPress,
  type TheaterMenuAction,
} from './TheaterItemMenu';
import type { Theater } from '../types';

type TheaterSwitcherProps = {
  variant: 'sidebar' | 'zen';
  onTheaterChange?: () => void;
};

function buildTheaterMenuActions(
  theater: Theater,
  handlers: {
    onRename: (theater: Theater) => void;
    onDelete: (theater: Theater) => void;
    canDelete: boolean;
  },
): TheaterMenuAction[] {
  return [
    {
      id: 'rename',
      icon: <Pencil size={16} />,
      label: 'Переименовать',
      onClick: () => handlers.onRename(theater),
    },
    {
      id: 'delete',
      icon: <Trash2 size={16} />,
      label: 'Удалить',
      onClick: () => handlers.onDelete(theater),
      danger: true,
      disabled: !handlers.canDelete,
    },
  ];
}

function TheaterListItem({
  theater,
  selected,
  variant,
  menuOpen,
  onMenuOpenChange,
  onSelect,
  onRename,
  onDelete,
  canDelete,
}: {
  theater: Theater;
  selected: boolean;
  variant: 'sidebar' | 'zen';
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onRename: (theater: Theater) => void;
  onDelete: (theater: Theater) => void;
  canDelete: boolean;
}) {
  const longPress = useTheaterRowLongPress(() => onMenuOpenChange(true));

  const actions = buildTheaterMenuActions(theater, { onRename, onDelete, canDelete });

  const rowClass =
    variant === 'zen'
      ? `flex w-full items-center gap-1 rounded-2xl transition-all ${
          selected ? 'zen-nav-link-active' : 'hover:bg-black/[0.03]'
        }`
      : `flex w-full items-center gap-1 rounded-lg transition-colors ${
          selected ? 'bg-gold/15' : 'hover:bg-white/5'
        }`;

  const selectClass =
    variant === 'zen'
      ? `flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-base transition-all ${
          selected
            ? 'font-semibold text-foreground'
            : 'text-muted hover:text-foreground'
        }`
      : `flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          selected ? 'font-medium text-gold-light' : 'text-muted hover:text-white'
        }`;

  return (
    <div className={rowClass}>
      <button
        type="button"
        onClick={() => {
          if (longPress.consumeLongPress()) return;
          onSelect();
        }}
        className={selectClass}
        {...longPress}
      >
        <span className="truncate">{theater.name}</span>
        {selected ? <Check size={16} className="shrink-0 text-accent" /> : null}
      </button>
      <div className="pr-1">
        <TheaterItemMenu
          variant={variant}
          actions={actions}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
        />
      </div>
    </div>
  );
}

export function TheaterSwitcher({ variant, onTheaterChange }: TheaterSwitcherProps) {
  const { state, dispatch } = useRehearsalStore();
  const { confirmDelete, prompt } = useConfirmDialog();
  const { createTheater } = useCreateTheater();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const canDelete = state.theaters.length > 1;

  const setActiveTheater = (theaterId: string) => {
    dispatch({ type: 'SET_ACTIVE_THEATER', payload: theaterId });
    onTheaterChange?.();
  };

  const renameTheater = async (theater: Theater) => {
    const name = await prompt({
      title: 'Переименовать театр',
      defaultValue: theater.name,
      confirmLabel: 'Сохранить',
    });
    if (!name) return;
    dispatch({ type: 'UPDATE_THEATER', payload: { ...theater, name } });
  };

  const deleteTheater = async (theater: Theater) => {
    if (!canDelete) return;
    const confirmed = await confirmDelete({
      title: `Удалить театр «${theater.name}»?`,
      message:
        'Все данные этого театра — постановки, сцены, репетиции и участники — будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить театр',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_THEATER', payload: theater.id });
  };

  const theaterList = (
    <div className={variant === 'zen' ? 'space-y-1' : 'space-y-0.5'}>
      {state.theaters.map((theater) => (
        <TheaterListItem
          key={theater.id}
          theater={theater}
          selected={theater.id === state.activeTheaterId}
          variant={variant}
          menuOpen={openMenuId === theater.id}
          onMenuOpenChange={(open) => setOpenMenuId(open ? theater.id : null)}
          onSelect={() => setActiveTheater(theater.id)}
          onRename={renameTheater}
          onDelete={deleteTheater}
          canDelete={canDelete}
        />
      ))}
    </div>
  );

  if (variant === 'sidebar') {
    return (
      <div className="mb-4 rounded-xl border border-gold/10 bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <Building2 size={14} />
            Театр
          </div>
          <button
            type="button"
            onClick={createTheater}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gold-light transition-colors hover:bg-gold/10"
          >
            <Plus size={13} />
            Новый
          </button>
        </div>
        {theaterList}
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
      {theaterList}
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
