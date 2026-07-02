import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';
import { useForceZenTheme } from '../hooks/useForceZenTheme';
import { LEGAL_DOCUMENTS } from '../content/legalOperator';

interface LegalDocumentLayoutProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalDocumentLayout({ title, updatedAt, children }: LegalDocumentLayoutProps) {
  useForceZenTheme();

  return (
    <div className="marketing-page zen-page min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Юридические документы</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Редакция от {updatedAt}</p>

        <nav className="mt-6 flex flex-wrap gap-3 text-sm">
          {Object.values(LEGAL_DOCUMENTS).map((doc) => (
            <Link
              key={doc.path}
              to={doc.path}
              className="rounded-full border border-border px-3 py-1 text-muted transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              {doc.title}
            </Link>
          ))}
        </nav>

        <article className="prose-legal mt-10 space-y-6 text-[15px] leading-relaxed text-muted">
          {children}
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}
