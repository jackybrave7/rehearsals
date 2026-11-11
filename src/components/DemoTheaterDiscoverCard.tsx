import { Sparkles } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveTheater } from '../store/selectors';
import { useInstallDemoTheater } from '../hooks/useInstallDemoTheater';

type DemoTheaterDiscoverCardProps = {
  variant: 'theater' | 'zen';
};

export function DemoTheaterDiscoverCard({ variant }: DemoTheaterDiscoverCardProps) {
  const { canCreateTheater } = useAuth();
  const { state, readOnly } = useRehearsalStore();
  const { hasDemo, installDemoTheater } = useInstallDemoTheater();
  const activeTheater = getActiveTheater(state);

  if (!canCreateTheater || readOnly || activeTheater?.isDemo) return null;

  const isZen = variant === 'zen';

  return (
    <section
      className={`rounded-2xl border px-4 py-4 sm:px-5 ${
        isZen
          ? 'border-border/60 bg-white'
          : 'border-gold/20 bg-gold/5'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Sparkles
            size={20}
            className={`mt-0.5 shrink-0 ${isZen ? 'text-foreground' : 'text-gold'}`}
            aria-hidden
          />
          <div className="min-w-0 text-sm">
            <h2 className={`font-medium ${isZen ? 'text-foreground' : 'text-white'}`}>
              {hasDemo ? 'Демо-театр с постановкой «Чайка»' : 'Посмотреть, как выглядит готовый план'}
            </h2>
            <p className={`mt-1 leading-relaxed ${isZen ? 'text-muted' : 'text-muted'}`}>
              {hasDemo
                ? 'Учебный «Демо-театр» с постановкой «Чайка» уже в аккаунте — откройте репетицию и попробуйте экспорт в Telegram или .ics. Лимит Free не тратит.'
                : 'Создадим «Демо-театр» с постановкой «Чайка»: сцены, роли, участники и репетиция с планом за пару кликов. Не занимает лимит Free.'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => void installDemoTheater()}
        >
          <Sparkles size={16} />
          {hasDemo ? 'Открыть пример' : 'Попробовать на примере'}
        </Button>
      </div>
    </section>
  );
}
