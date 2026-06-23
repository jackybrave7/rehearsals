import type { LucideIcon } from 'lucide-react';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
      <Icon size={20} className="text-gold/70" />
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-muted">
        {label}
        {sub ? <span className="text-muted/70"> · {sub}</span> : null}
      </p>
    </div>
  );
}

export function AdminErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
      {error === 'FORBIDDEN'
        ? 'Нет доступа к админке. Добавьте email в ADMIN_EMAILS на сервере.'
        : error === 'NOT_FOUND'
          ? 'Пользователь не найден.'
          : `Ошибка: ${error}`}
    </div>
  );
}
