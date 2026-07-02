import { Link } from 'react-router-dom';
import { appPaths } from '../navigation/appPaths';
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from '../content/legalOperator';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-semibold text-foreground">{LEGAL_OPERATOR.serviceName}</p>
            <p className="mt-2 text-sm text-muted">Планировщик репетиций для театральных коллективов</p>
            <p className="mt-4 text-sm text-muted">
              <a href={`mailto:${LEGAL_OPERATOR.email}`} className="hover:text-foreground">
                {LEGAL_OPERATOR.email}
              </a>
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Сервис</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to={appPaths.home} className="text-muted hover:text-foreground">
                  Приложение
                </Link>
              </li>
              <li>
                <Link to={appPaths.pricing} className="text-muted hover:text-foreground">
                  Тарифы
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-muted hover:text-foreground">
                  Вход
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Документы</p>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.values(LEGAL_DOCUMENTS).map((doc) => (
                <li key={doc.path}>
                  <Link to={doc.path} className="text-muted hover:text-foreground">
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-sm text-muted">
          <p>
            © {new Date().getFullYear()} {LEGAL_OPERATOR.fullName}
          </p>
          <p className="mt-2">
            {LEGAL_OPERATOR.region} · ИНН {LEGAL_OPERATOR.inn} · ОГРНИП {LEGAL_OPERATOR.ogrnip}
          </p>
        </div>
      </div>
    </footer>
  );
}
