import { useMemo, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRehearsalStore } from '../../store/RehearsalContext';
import { useAuth } from '../../store/AuthContext';
import { useDesign } from '../../store/DesignContext';
import {
  getTheaterSetupProgress,
  isGuideChecklistHidden,
  setGuideChecklistHidden,
} from '../../utils/guideOnboarding';
import { appPaths } from '../../navigation/appPaths';

interface TheaterSetupChecklistProps {
  variant?: 'theater' | 'zen';
}

export function TheaterSetupChecklist({ variant = 'theater' }: TheaterSetupChecklistProps) {
  const { state } = useRehearsalStore();
  const { canEditTheater } = useAuth();
  const { isZen } = useDesign();
  const theme = variant ?? (isZen ? 'zen' : 'theater');
  const [hidden, setHidden] = useState(isGuideChecklistHidden);
  const canEdit = canEditTheater(state.activeTheaterId);
  const { steps, completed, total, allDone } = useMemo(
    () => getTheaterSetupProgress(state),
    [state]
  );
  const firstIncomplete = steps.findIndex((s) => !s.done);
  const currentStep = firstIncomplete === -1 ? total : firstIncomplete + 1;

  if (!canEdit || hidden || allDone) return null;

  const cardClass =
    theme === 'zen'
      ? 'zen-card overflow-hidden'
      : 'rounded-2xl border border-gold/15 bg-surface/60 overflow-hidden';

  return (
    <section className={cardClass} aria-label="Настройка театра">
      <div className="flex items-start justify-between gap-3 border-b border-gold/10 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Быстрый старт</p>
          <h2 className="text-lg font-semibold text-foreground">
            Настройка театра: шаг {currentStep} из {total}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setGuideChecklistHidden(true);
            setHidden(true);
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground"
          aria-label="Скрыть чеклист"
        >
          <X size={14} />
          Скрыть
        </button>
      </div>
      <ol className="space-y-1 px-3 py-3">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                theme === 'zen' ? 'hover:bg-black/[0.03]' : 'hover:bg-white/5'
              } ${step.done ? 'text-muted' : 'text-foreground'}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  step.done
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                    : theme === 'zen'
                      ? 'border-border/70 text-muted'
                      : 'border-gold/20 text-muted'
                }`}
                aria-hidden
              >
                {step.done ? <Check size={14} /> : null}
              </span>
              <span className={`min-w-0 flex-1 ${step.done ? 'line-through' : ''}`}>{step.label}</span>
              {!step.done && <ChevronRight size={16} className="shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ol>
      {completed === total - 1 && !steps[total - 1]?.done && (
        <p className="border-t border-gold/10 px-5 py-3 text-xs text-muted">
          Подсказки по шагам — в{' '}
          <Link to={`${appPaths.guide}#bystryj-start`} className="text-gold-light hover:underline">
            руководстве
          </Link>
          .
        </p>
      )}
    </section>
  );
}

export function restoreGuideChecklist() {
  setGuideChecklistHidden(false);
}
