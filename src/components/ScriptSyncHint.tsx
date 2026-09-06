import { useDesign } from '../store/DesignContext';

interface ScriptSyncHintProps {
  variant?: 'full' | 'compact';
  className?: string;
}

export function ScriptSyncHint({ variant = 'full', className = '' }: ScriptSyncHintProps) {
  const { isZen } = useDesign();

  const boxClass =
    variant === 'compact'
      ? `rounded-lg border px-3 py-2 text-xs text-muted ${
          isZen ? 'border-border/60 bg-black/[0.02]' : 'border-gold/15 bg-gold/5'
        }`
      : `rounded-lg border p-3 text-sm text-muted ${
          isZen ? 'border-border/60 bg-black/[0.02]' : 'border-gold/10 bg-black/20'
        }`;

  if (variant === 'compact') {
    return (
      <p className={`${boxClass} ${className}`}>
        <strong className={isZen ? 'text-foreground' : 'text-white'}>Один документ — два способа:</strong>{' '}
        ссылка на Google Docs (ссылки на сцены) + .docx из того же файла (знаки и «Учить текст»). После
        правок в Google снова скачайте .docx и повторите сопоставление.
      </p>
    );
  }

  return (
    <div className={`${boxClass} ${className}`}>
      <p className={`font-medium ${isZen ? 'text-foreground' : 'text-foreground'}`}>
        Синхронизация текста без входа в Google
      </p>
      <p className="mt-1">
        Чтобы сцены, знаки и ссылки на фрагменты совпадали, используйте{' '}
        <strong className={isZen ? 'text-foreground' : 'text-white'}>один и тот же</strong> текст двумя
        способами:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-4">
        <li>
          В карточке постановки укажите <strong className="text-white">ссылку на Google Docs</strong> и
          откройте доступ: «Все, у кого есть ссылка» → «Читатель».
        </li>
        <li>
          В том же Google Docs: <strong className="text-white">Файл → Скачать → Microsoft Word (.docx)</strong>{' '}
          — загрузите файл в карточке постановки.
        </li>
        <li>
          На странице «Сцены»: <strong className="text-white">Импорт из файла → Сопоставить сцены</strong>{' '}
          (список, знаки, «Учить текст»), затем{' '}
          <strong className="text-white">Google Docs → Сопоставить ссылки</strong>.
        </li>
        <li>
          После правок в Google Docs снова скачайте .docx, замените файл и повторите оба сопоставления.
        </li>
      </ol>
    </div>
  );
}
