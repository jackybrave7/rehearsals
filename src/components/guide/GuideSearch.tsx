import { Search, X } from 'lucide-react';
import { useDesign } from '../../store/DesignContext';

interface GuideSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
}

export function GuideSearch({ value, onChange, resultCount }: GuideSearchProps) {
  const { isZen } = useDesign();

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="guide-search">
        Поиск по руководству
      </label>
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isZen ? 'border-border/70 bg-white' : 'border-gold/15 bg-surface/60'
        }`}
      >
        <Search size={18} className="shrink-0 text-muted" aria-hidden />
        <input
          id="guide-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Поиск от 2 символов…"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded p-1 text-muted hover:text-foreground"
            aria-label="Очистить поиск"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {value.length >= 2 && (
        <p className="text-xs text-muted">
          {resultCount > 0 ? `Найдено разделов: ${resultCount}` : 'Ничего не найдено'}
        </p>
      )}
    </div>
  );
}
