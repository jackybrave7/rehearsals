import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PRO_PRICING, SUPPORT_EMAIL } from '../types/subscription';

export const PRICING_COPY = {
  badge: 'Планировщик постановки для театральных коллективов',
  title: 'Один спектакль — бесплатно.',
  titleAccent: 'Весь репертуар — в Pro.',
  subtitle:
    'Сцены, почасовой план, посещаемость и рассылка в Telegram. Платите, только когда ведёте больше одной постановки.',
  facts: 'Онлайн-сервис · совместная работа · русский интерфейс',
  footNote:
    'Тариф привязан к вашему аккаунту — приглашайте сколько угодно участников на любом плане.',
  free: {
    name: 'Free',
    description: 'Чтобы вести одну постановку от первой читки до премьеры.',
    price: '0 ₽',
    per: 'навсегда',
    note: 'Без карты, без срока.',
    cta: 'Начать бесплатно',
    features: [
      '<b>1 активная постановка</b>, 1 театр',
      'Сцены, участники, репетиции, площадки, задачи — без лимита',
      'Привязка сцен к Google Docs и хронометраж',
      'Почасовой «План по времени»',
      'Рассылка плана в чат Telegram вручную',
      'Экспорт в Google Календарь и .ics',
    ],
    mutedFeature: 'Архив постановок — только просмотр',
  },
  pro: {
    tag: 'Для режиссёра',
    name: 'Pro',
    description: 'Весь репертуар сразу и автоматические напоминания за вас.',
    cta: 'Перейти на Pro',
    noteMonth: `Или ${PRO_PRICING.yearlyRub.toLocaleString('ru-RU')} ₽ в год — выгоднее на 2 месяца.`,
    noteYear: `${PRO_PRICING.yearlyRub.toLocaleString('ru-RU')} ₽ при оплате за год — это ${Math.round(PRO_PRICING.yearlyRub / 12)} ₽ в месяц.`,
    features: [
      '<b>Без лимита постановок</b> и театров',
      '<b>Личные авто-напоминания</b> участникам в Telegram',
      'Шаблоны репетиций и повтор расписания сериями',
      'История работы и аналитика посещаемости по актёрам',
      'Приоритетная поддержка',
    ],
  },
} as const;

export function formatProMonthlyPrice(): string {
  return `${PRO_PRICING.monthlyRub.toLocaleString('ru-RU')} ₽`;
}

export function formatProYearlyPrice(): string {
  return `${PRO_PRICING.yearlyRub.toLocaleString('ru-RU')} ₽`;
}

export function supportMailto(subject = 'Тариф Pro'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function PricingFeatureList({
  items,
  muted,
}: {
  items: readonly string[];
  muted?: string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center text-accent">
            ✓
          </span>
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
      {muted && (
        <li className="flex items-start gap-3 text-sm leading-relaxed text-muted/70">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/50" />
          <span>{muted}</span>
        </li>
      )}
    </ul>
  );
}

export function PricingCtaLink({
  variant,
  children,
  className = '',
}: {
  variant: 'primary' | 'ghost';
  children: ReactNode;
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-center text-[15px] font-bold transition-all';
  const styles =
    variant === 'primary'
      ? 'bg-foreground text-background hover:-translate-y-px hover:shadow-lg'
      : 'border border-border bg-surface text-foreground hover:border-foreground/30';

  return (
    <Link to="/app" className={`${base} ${styles} ${className}`}>
      {children}
      {variant === 'primary' && <ArrowRight size={18} />}
    </Link>
  );
}
