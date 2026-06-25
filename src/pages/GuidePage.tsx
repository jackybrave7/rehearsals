import { BookMarked } from 'lucide-react';
import { GuideMarkdown } from '../components/GuideMarkdown';
import guideSource from '../content/guide.md?raw';
import { pageTitleClass } from '../utils/pageLayout';

export function GuidePage() {
  return (
    <div className="space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
          <BookMarked size={14} />
          Справка
        </div>
        <h1 className={pageTitleClass}>Руководство</h1>
        <p className="mt-1 text-muted">Как пользоваться приложением «Репетиции»</p>
      </header>

      <article className="rounded-2xl border border-gold/10 bg-surface/40 p-4 sm:p-6 lg:p-8">
        <GuideMarkdown source={guideSource} />
      </article>
    </div>
  );
}
