import { Link } from 'react-router-dom';
import { useRegistrationMode } from '../hooks/useRegistrationMode';
import { useMaxLg } from '../hooks/useMaxLg';
import { useDesign } from '../store/DesignContext';
import { appPaths } from '../navigation/appPaths';

export function BetaVersionBanner() {
  const mode = useRegistrationMode();
  const isMobile = useMaxLg();
  const { isZen } = useDesign();

  if (mode !== 'beta') return null;

  return (
    <div
      className={
        isZen
          ? 'border-b px-3 py-1 text-center text-[11px] leading-tight sm:px-4'
          : `border-b text-center ${
              isMobile ? 'px-3 py-1 text-[11px] leading-tight' : 'px-4 py-1.5 text-xs'
            }`
      }
      style={{
        backgroundColor: 'var(--color-warning-bg)',
        borderColor: 'var(--color-warning-border)',
        color: 'var(--color-warning-text)',
      }}
    >
      Бетта-версия,{' '}
      <Link
        to={appPaths.support}
        className="font-medium underline underline-offset-2 hover:opacity-80"
        style={{ color: 'var(--color-warning-title)' }}
      >
        написать разработчику
      </Link>
    </div>
  );
}
