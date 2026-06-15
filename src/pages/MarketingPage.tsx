import { Link } from 'react-router-dom';
import { appPaths } from '../navigation/appPaths';
import { useForceZenTheme } from '../hooks/useForceZenTheme';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Layers,
  MessageCircle,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

const features = [
  {
    icon: Clock,
    title: 'План по минутам',
    description:
      'Не просто «18:00–21:00», а сценарий репетиции: сцены, задачи, разминка, перерывы — с автопересчётом времени и предупреждениями, если план не влезает.',
  },
  {
    icon: FileText,
    title: 'Google Docs → сцены',
    description:
      'Привяжите сцены к заголовкам в тексте пьесы. Актёры получают прямые ссылки на свой фрагмент — прямо в сообщении Telegram.',
  },
  {
    icon: MessageCircle,
    title: 'Рассылка в Telegram',
    description:
      'Готовое сообщение с датой, местом, участниками, @username и планом по минутам. Копируйте или отправляйте через бота.',
  },
  {
    icon: Users,
    title: 'Кого ждём',
    description:
      'Список участников собирается сам из состава, сцен и задач. Видно, кто нужен и зачем — и есть ли пересечения с другими репетициями.',
  },
  {
    icon: Layers,
    title: 'Прогресс по сценам',
    description:
      'Статусы, приоритеты, история прохождений и заметки режиссёра. Система напомнит, если сцена «в работе», но давно не репетировалась.',
  },
  {
    icon: CalendarDays,
    title: 'Шаблоны и серии',
    description:
      'Сохраните удачный план как шаблон и разверните еженедельную серию — «каждый вторник до премьеры».',
  },
];

const steps = [
  {
    step: '01',
    title: 'Загрузите постановку',
    text: 'Добавьте пьесу, сцены и состав. Подключите ссылку на Google Docs — якоря сцен подтянутся автоматически.',
  },
  {
    step: '02',
    title: 'Соберите план репетиции',
    text: 'Перетащите сцены в почасовой план, назначьте задачи и перерывы. Сразу видно, кого ждать и где конфликты.',
  },
  {
    step: '03',
    title: 'Отправьте труппе',
    text: 'Экспортируйте в Telegram, добавьте в Google Календарь или скачайте .ics. Актёры знают, что, когда и где репетировать.',
  },
];

const comparisonAlternatives = [
  'Excel / Таблицы',
  'Google Календарь',
  'Notion',
  'Темза',
  '1С:Театр',
];

const comparisonRows = [
  { label: 'Почасовой план репетиции', us: true, them: 'partial' as const },
  { label: 'Сцены + прогресс постановки', us: true, them: 'partial' as const },
  { label: 'Google Docs → ссылки на текст', us: true, them: false as const },
  { label: 'Готовая рассылка в Telegram', us: true, them: 'partial' as const },
  { label: 'Репертуар всего театра', us: false as const, them: true as const },
  { label: 'Кадры и бухгалтерия', us: false as const, them: true as const },
  { label: 'Старт за 5 минут', us: true, them: false as const },
];

const audiences = [
  'Студенческие и любительские театры',
  'Независимые коллективы на одной постановке',
  'Режиссёры, которые ведут процесс сами',
  'Труппы, где текст в Google Docs, а связь — в Telegram',
];

function ComparisonCell({ value }: { value: boolean | 'partial' }) {
  if (value === true) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Check size={15} strokeWidth={2.5} />
      </span>
    );
  }
  if (value === 'partial') {
    return <span className="text-sm font-medium text-gold-light/70">частично</span>;
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-muted/60">
      <X size={15} />
    </span>
  );
}

export function MarketingPage() {
  useForceZenTheme();

  return (
    <div className="marketing-page zen-page min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-foreground no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold">
              Р
            </span>
            <span className="text-lg font-semibold tracking-tight">Репетиции</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Возможности
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              Как это работает
            </a>
            <a href="#compare" className="transition-colors hover:text-foreground">
              Сравнение
            </a>
          </nav>
          <Link
            to={appPaths.home}
            className="zen-primary-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            Открыть приложение
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(224, 74, 18, 0.12), transparent 70%)',
            }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted">
              <Sparkles size={14} className="text-accent" />
              Планировщик постановки для театральных коллективов
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              От сцены в Google Docs —
              <br />
              <span className="text-accent">до сообщения в Telegram</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Репетиции — для режиссёра, который ведёт постановку сам: сцены, состав, почасовой план
              и рассылка труппе. Без 1С, без внедрения на месяцы.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to={appPaths.home}
                className="zen-primary-btn inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold transition-colors"
              >
                Начать бесплатно
                <ArrowRight size={18} />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-black/5"
              >
                Как это работает
              </a>
            </div>
            <p className="mt-6 text-sm text-muted/80">
              Self-hosted · данные у вас · русский интерфейс
            </p>
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-gold/10 bg-surface/40 px-5 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">Знакомо?</h2>
                <ul className="mt-6 space-y-4 text-muted">
                  {[
                    'Состав в одной таблице, сцены — в другой, план репетиции — в третьей',
                    'Каждый раз вручную копируете план в Telegram и забываете @username',
                    'Актёры спрашивают: «А где мой текст?» — и вы ищете ссылку в Google Docs',
                    'Темза и 1С — для всего театра, а вам нужна одна постановка',
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-gold/15 bg-background/60 p-8">
                <p className="text-sm font-medium uppercase tracking-widest text-gold">Решение</p>
                <p className="mt-4 text-xl font-semibold leading-snug text-white">
                  Один инструмент для репетиционного цикла — от текста пьесы до готового сообщения
                  актёрам.
                </p>
                <p className="mt-4 leading-relaxed text-muted">
                  Не ERP для дирекции, а режиссёрский пульт: что репетируем, кого ждём, что забыли,
                  что отправить в чат.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Сделано для репетиции</h2>
              <p className="mt-4 text-lg text-muted">
                Не универсальная CRM, а инструмент с театральной логикой внутри.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-gold/10 bg-surface/50 p-6 transition-colors hover:border-gold/20 hover:bg-surface/80"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gold/15 bg-gold/10">
                    <Icon size={20} className="text-gold" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-gold/10 bg-surface/30 px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Три шага</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-muted">
              От пустой постановки до первой рассылки — за один вечер.
            </p>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map(({ step, title, text }) => (
                <div key={step} className="relative text-center md:text-left">
                  <span className="text-5xl font-bold text-gold/20">{step}</span>
                  <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">
              Не замена Темзе — другой продукт
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
              Темза и 1С:Театр — для всего учреждения. Репетиции — для постановки, которую ведёт
              режиссёр в Google Docs и Telegram.
            </p>
            <div className="mt-12 overflow-hidden rounded-2xl border border-gold/15">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gold/10 bg-surface/60">
                    <th className="px-5 py-4 font-medium text-muted">Возможность</th>
                    <th className="px-5 py-4 text-center font-semibold text-gold">Репетиции</th>
                    <th className="hidden px-5 py-4 text-center font-medium text-muted sm:table-cell">
                      Excel · Календарь · Notion · Темза · 1С
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(({ label, us, them }) => (
                    <tr key={label} className="border-b border-gold/5 last:border-0">
                      <td className="px-5 py-4 text-foreground">{label}</td>
                      <td className="px-5 py-4 text-center">
                        <ComparisonCell value={us} />
                      </td>
                      <td className="hidden px-5 py-4 text-center sm:table-cell">
                        <ComparisonCell value={them} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center text-xs text-muted/70">
              {comparisonAlternatives.join(' · ')}
            </p>
          </div>
        </section>

        {/* Audience */}
        <section className="border-t border-gold/10 bg-surface/40 px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Для кого</h2>
            <ul className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
              {audiences.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-gold/10 bg-background/40 px-4 py-3"
                >
                  <Check size={18} className="mt-0.5 shrink-0 text-gold" />
                  <span className="text-sm text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/10 to-transparent px-8 py-14 text-center sm:px-14">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Постановка ждёт. План — за пять минут.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted">
              Откройте приложение, добавьте постановку и соберите первую репетицию. Без договоров и
              внедрения.
            </p>
            <Link
              to={appPaths.home}
              className="zen-primary-btn mt-8 inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-semibold transition-colors"
            >
              Открыть Репетиции
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gold/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Репетиции — планировщик постановки</p>
          <div className="flex gap-6">
            <Link to={appPaths.home} className="transition-colors hover:text-gold-light">
              Приложение
            </Link>
            <a href="#features" className="transition-colors hover:text-gold-light">
              Возможности
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
