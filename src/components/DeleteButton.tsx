import { type ButtonHTMLAttributes } from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  iconSize?: number;
}

export function DeleteButton({
  label = 'Удалить',
  iconSize = 14,
  className = '',
  ...props
}: DeleteButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`delete-btn inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted/45 transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      <Trash2 size={iconSize} strokeWidth={1.75} />
    </button>
  );
}
