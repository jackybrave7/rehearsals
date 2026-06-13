import { Check, Palette, Sparkles, AlertTriangle } from 'lucide-react';
import { useDesign, type AppDesign } from '../store/DesignContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getShowRehearsalWarnings } from '../store/selectors';

const options: Array<{
  id: AppDesign;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    id: 'theater',
    title: 'Театр',
    description: 'Классический тёмный интерфейс с боковым меню и полным обзором данных.',
    preview: 'Тёмный · золото · sidebar',
  },
  {
    id: 'zen',
    title: 'Дзен',
    description:
      'Светлый минимализм: в центре только актуальное, остальное — в контекстном меню. Плавные анимации.',
    preview: 'Светлый · воздух · фокус',
  },
];

export function SettingsPage() {
  const { design, setDesign } = useDesign();
  const { state, dispatch } = useRehearsalStore();
  const showRehearsalWarnings = getShowRehearsalWarnings(state);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Настройки</h1>
        <p className="mt-1 text-muted">Общие параметры приложения</p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Palette size={16} />
          Оформление
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {options.map((option) => {
            const selected = design === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDesign(option.id)}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                  selected
                    ? 'border-gold/40 bg-gold/10 ring-1 ring-gold/20'
                    : 'border-gold/10 bg-surface/40 hover:border-gold/25'
                }`}
              >
                <div
                  className={`mb-4 h-24 rounded-xl border transition-transform duration-300 group-hover:scale-[1.02] ${
                    option.id === 'theater'
                      ? 'border-gold/20 bg-gradient-to-br from-[#1a1212] to-[#0f0a0a]'
                      : 'border-black/5 bg-gradient-to-br from-[#ffffff] to-[#f3f4f6] shadow-inner'
                  }`}
                >
                  <div className="flex h-full items-end p-3">
                    <span
                      className={`text-xs font-medium ${
                        option.id === 'theater' ? 'text-gold-light/80' : 'text-black/45'
                      }`}
                    >
                      {option.preview}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                      {option.id === 'zen' && <Sparkles size={18} className="text-gold" />}
                      {option.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{option.description}</p>
                  </div>
                  {selected && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-light">
                      <Check size={16} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted/80">
          Выбор сохраняется на этом устройстве. Переключение применяется сразу, без перезагрузки.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <AlertTriangle size={16} />
          Репетиции
        </div>

        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-gold/10 bg-surface/40 p-5 transition-colors hover:border-gold/20">
          <input
            type="checkbox"
            checked={showRehearsalWarnings}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_APP_META',
                payload: { showRehearsalWarnings: event.target.checked },
              })
            }
            className="mt-1 h-4 w-4 rounded border-gold/30 accent-gold"
          />
          <span className="min-w-0">
            <span className="block text-base font-medium text-white">
              Предупреждения перед репетицией
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">
              Автоматически показывать уведомления на обзоре и в карточке репетиции: пустой план,
              участники без Telegram, давно не репетировавшиеся сцены, открытые задачи и конфликты
              в календаре.
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
