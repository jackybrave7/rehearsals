import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { useForceZenTheme } from '../hooks/useForceZenTheme';
import {
  PRICING_COPY,
  PricingCtaLink,
  PricingFeatureList,
  formatProMonthlyPrice,
  formatProYearlyPrice,
  supportMailto,
} from '../content/pricing';

export function PricingPage() {
  useForceZenTheme();
  const [yearly, setYearly] = useState(false);

  return (
    <div className="marketing-page zen-page min-h-screen bg-background text-foreground">
      <p className="pt-3 text-center text-xs font-medium text-emerald-700">Онлайн · данные сохраняются на сервере</p>

      <MarketingHeader current="pricing" />

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8">
        <section className="text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted shadow-sm">
            <Sparkles size={14} className="text-accent" />
            {PRICING_COPY.badge}
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {PRICING_COPY.title}
            <br />
            <span className="text-accent">{PRICING_COPY.titleAccent}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">{PRICING_COPY.subtitle}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className={`text-sm font-semibold ${!yearly ? 'text-foreground' : 'text-muted'}`}>
              Помесячно
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={yearly}
              onClick={() => setYearly((value) => !value)}
              className={`relative h-7 w-[52px] rounded-full border border-border bg-background transition-colors ${
                yearly ? 'bg-foreground/5' : ''
              }`}
            >
              <span
                className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-foreground transition-transform ${
                  yearly ? 'translate-x-6' : ''
                }`}
              />
            </button>
            <span className={`text-sm font-semibold ${yearly ? 'text-foreground' : 'text-muted'}`}>
              Раз в год
            </span>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-accent">
              −2 месяца
            </span>
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-[22px] border border-border bg-surface p-7 shadow-[0_8px_30px_-12px_rgba(30,25,40,0.18)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{PRICING_COPY.free.name}</p>
            <p className="mt-2 min-h-[42px] text-sm text-muted">{PRICING_COPY.free.description}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">{PRICING_COPY.free.price}</span>
              <span className="text-sm text-muted">{PRICING_COPY.free.per}</span>
            </div>
            <p className="mt-1 min-h-5 text-sm text-muted">{PRICING_COPY.free.note}</p>
            <PricingCtaLink variant="ghost" className="mt-6 w-full">
              {PRICING_COPY.free.cta}
            </PricingCtaLink>
            <div className="my-6 h-px bg-border" />
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Входит</p>
            <PricingFeatureList items={PRICING_COPY.free.features} muted={PRICING_COPY.free.mutedFeature} />
          </article>

          <article className="relative flex flex-col rounded-[22px] border-2 border-accent bg-surface p-7 shadow-[0_8px_30px_-12px_rgba(30,25,40,0.18)] sm:p-8">
            <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
              {PRICING_COPY.pro.tag}
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{PRICING_COPY.pro.name}</p>
            <p className="mt-2 min-h-[42px] text-sm text-muted">{PRICING_COPY.pro.description}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">
                {yearly ? formatProYearlyPrice() : formatProMonthlyPrice()}
              </span>
              <span className="text-sm text-muted">{yearly ? '/ год' : '/ мес'}</span>
            </div>
            <p className="mt-1 min-h-5 text-sm text-muted">
              {yearly ? PRICING_COPY.pro.noteYear : PRICING_COPY.pro.noteMonth}
            </p>
            <a
              href={supportMailto()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3.5 text-center text-[15px] font-bold text-background transition-all hover:-translate-y-px hover:shadow-lg"
            >
              {PRICING_COPY.pro.cta}
              <ArrowRight size={18} />
            </a>
            <div className="my-6 h-px bg-border" />
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              Всё из Free, плюс
            </p>
            <PricingFeatureList items={PRICING_COPY.pro.features} />
          </article>
        </section>

        <p className="mt-8 text-center text-sm font-medium text-muted">{PRICING_COPY.facts}</p>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-muted/80">
          {PRICING_COPY.footNote} Вопросы по тарифам?{' '}
          <a href={supportMailto()} className="text-accent underline-offset-2 hover:underline">
            Напишите нам
          </a>
          .
        </p>
        <p className="mt-6 text-center text-xs text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/app/settings" className="text-accent hover:underline">
            Тариф в настройках
          </Link>
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
