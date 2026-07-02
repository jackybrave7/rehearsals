import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { appPaths } from '../navigation/appPaths';
import { AppLogo } from './AppLogo';

interface MarketingHeaderProps {
  current?: 'home' | 'pricing';
}

export function MarketingHeader({ current }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" className="text-foreground no-underline">
          <AppLogo showLabel labelClassName="text-lg font-semibold tracking-tight text-foreground" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
          {current === 'home' ? (
            <a href="#features" className="transition-colors hover:text-foreground">
              Возможности
            </a>
          ) : (
            <Link to="/#features" className="transition-colors hover:text-foreground">
              Возможности
            </Link>
          )}
          {current === 'home' ? (
            <a href="#how" className="transition-colors hover:text-foreground">
              Как это работает
            </a>
          ) : (
            <Link to="/#how" className="transition-colors hover:text-foreground">
              Как это работает
            </Link>
          )}
          <Link
            to="/pricing"
            className={current === 'pricing' ? 'font-medium text-foreground' : 'transition-colors hover:text-foreground'}
          >
            Тарифы
          </Link>
        </nav>
        <Link
          to={appPaths.home}
          className="zen-primary-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          {current === 'pricing' ? (
            <>
              <Sparkles size={16} />
              Начать бесплатно
            </>
          ) : (
            'Открыть приложение'
          )}
        </Link>
      </div>
    </header>
  );
}
