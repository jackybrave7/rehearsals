import { useMemo, useState } from 'react';
import {
  extractDripEmailInnerBody,
  injectDripEmailInnerBody,
  isFullDripEmailDocument,
  previewDripEmailHtml,
  wrapFullDripEmailHtml,
} from '../../../shared/dripEmailDocument';
import { Textarea } from '../FormFields';
import { DripRichTextEditor } from './DripRichTextEditor';

type Props = {
  html: string;
  onChange: (html: string) => void;
  appUrl: string;
  actionLabel: string;
  actionPath: string;
  sampleGreeting?: string;
};

type EditorMode = 'visual' | 'html';

export function DripFullEmailEditor({
  html,
  onChange,
  appUrl,
  actionLabel,
  actionPath,
  sampleGreeting = 'Анна',
}: Props) {
  const [mode, setMode] = useState<EditorMode>('visual');
  const previewLogoUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/email/logo.png` : undefined;

  const innerBody = useMemo(() => extractDripEmailInnerBody(html), [html]);

  const previewHtml = useMemo(
    () => previewDripEmailHtml(html, appUrl, sampleGreeting, previewLogoUrl),
    [html, appUrl, sampleGreeting, previewLogoUrl]
  );

  const applyInnerBody = (nextInner: string) => {
    if (isFullDripEmailDocument(html)) {
      onChange(injectDripEmailInnerBody(html, nextInner));
      return;
    }
    onChange(
      wrapFullDripEmailHtml({
        innerBodyHtml: nextInner,
        actionLabel: actionLabel || 'Открыть приложение',
        actionPath: actionPath || '/app',
      })
    );
  };

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
          В превью имя «{sampleGreeting}»; в письме подставится имя получателя. Логотип:{' '}
          <code className="text-gold-light">/email/logo.png</code>. В HTML —{' '}
          <code className="text-gold-light">{'{{GREETING}}'}</code> и{' '}
          <code className="text-gold-light">{'{{APP_URL}}'}</code>.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${
            mode === 'visual' ? 'bg-gold/20 text-gold-light' : 'text-muted hover:bg-white/5'
          }`}
          onClick={() => setMode('visual')}
        >
          Визуальный редактор
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${
            mode === 'html' ? 'bg-gold/20 text-gold-light' : 'text-muted hover:bg-white/5'
          }`}
          onClick={() => setMode('html')}
        >
          HTML целиком
        </button>
      </div>

      {mode === 'visual' ? (
        <DripRichTextEditor html={innerBody} onChange={applyInnerBody} />
      ) : (
        <Textarea
          label="HTML письма (полный шаблон)"
          rows={16}
          className="font-mono text-xs leading-relaxed"
          value={html}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
