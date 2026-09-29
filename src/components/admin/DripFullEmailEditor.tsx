import { useMemo } from 'react';
import { previewDripEmailHtml } from '../../../shared/dripEmailDocument';
import { Textarea } from '../FormFields';

type Props = {
  html: string;
  onChange: (html: string) => void;
  appUrl: string;
  sampleGreeting?: string;
};

export function DripFullEmailEditor({ html, onChange, appUrl, sampleGreeting = 'Анна' }: Props) {
  const previewHtml = useMemo(
    () => previewDripEmailHtml(html, appUrl, sampleGreeting),
    [html, appUrl, sampleGreeting]
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Как видит получатель
        </p>
        <div className="overflow-hidden rounded-xl border border-gold/15 bg-[#f0eeea]">
          <iframe
            title="Превью письма"
            srcDoc={previewHtml}
            className="block h-[420px] w-full border-0 bg-white"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          В превью имя «{sampleGreeting}»; в письме подставится имя получателя. В HTML используйте{' '}
          <code className="text-gold-light">{'{{GREETING}}'}</code> и{' '}
          <code className="text-gold-light">{'{{APP_URL}}'}</code>.
        </p>
      </div>
      <Textarea
        label="HTML письма (полный шаблон)"
        rows={16}
        className="font-mono text-xs leading-relaxed"
        value={html}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
