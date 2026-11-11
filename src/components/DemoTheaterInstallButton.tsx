import { Sparkles } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveTheater } from '../store/selectors';
import { useInstallDemoTheater } from '../hooks/useInstallDemoTheater';

type DemoTheaterInstallButtonProps = {
  variant: 'sidebar' | 'zen';
};

export function DemoTheaterInstallButton({ variant }: DemoTheaterInstallButtonProps) {
  const { canCreateTheater } = useAuth();
  const { state, readOnly } = useRehearsalStore();
  const { hasDemo, installDemoTheater } = useInstallDemoTheater();
  const activeTheater = getActiveTheater(state);

  if (!canCreateTheater || readOnly || activeTheater?.isDemo) return null;

  const label = hasDemo ? 'К учебному примеру' : 'Добавить пример';

  if (variant === 'zen') {
    return (
      <button
        type="button"
        onClick={() => void installDemoTheater()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 px-3 py-2.5 text-sm text-muted transition-colors hover:border-border hover:bg-black/[0.02] hover:text-foreground"
      >
        <Sparkles size={16} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void installDemoTheater()}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gold/25 px-3 py-2 text-xs text-gold-light transition-colors hover:border-gold/40 hover:bg-gold/5"
    >
      <Sparkles size={14} />
      {label}
    </button>
  );
}
