import { Check, Drama, Palette, Sparkles } from 'lucide-react';
import { useDesign, type AppDesign } from '../store/DesignContext';

const options: Array<{
  id: AppDesign;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    id: 'theater',
    title: 'Театр-театр',
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

export function DesignThemePicker() {
  const { design, setDesign } = useDesign();

  return (
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
                <div className="flex h-full items-end justify-between p-3">
                  {option.id === 'theater' ? (
                    <Drama size={28} className="text-gold-light/70" aria-hidden />
                  ) : (
                    <span />
                  )}
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
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    {option.id === 'theater' && <Drama size={18} className="text-gold" />}
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
  );
}
