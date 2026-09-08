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
          ? 'border-b border-amber-500/20 bg-amber-500/10 px-3 py-1 text-center text-[11px] leading-tight text-amber-100/95 sm:px-4'
          : `border-b border-amber-500/20 bg-amber-500/10 text-center text-amber-100/95 ${
              isMobile ? 'px-3 py-1 text-[11px] leading-tight' : 'px-4 py-1.5 text-xs'
            }`
      }
    >
      Бетта-версия,{' '}
      <Link to={appPaths.support} className="font-medium text-amber-50 underline underline-offset-2 hover:text-white">
        написать разработчику
      </Link>
    </div>
  );
}
