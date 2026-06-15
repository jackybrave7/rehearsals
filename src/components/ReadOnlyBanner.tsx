import { Eye } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { THEATER_ROLE_LABELS } from '../types/auth';

export function ReadOnlyBanner() {
  const { state } = useRehearsalStore();
  const { getTheaterRole } = useAuth();
  const role = getTheaterRole(state.activeTheaterId);

  if (role !== 'observer') return null;

  return (
    <div className="border-b border-amber-500/20 bg-amber-950/30 px-4 py-2 text-sm text-amber-100 sm:px-6">
      <div className="flex items-center gap-2">
        <Eye size={16} />
        Режим наблюдателя ({THEATER_ROLE_LABELS.observer}): изменения недоступны
      </div>
    </div>
  );
}
