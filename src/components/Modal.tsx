import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  xl?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide, xl }: ModalProps) {
  if (!open) return null;

  const widthClass = xl ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative flex max-h-[90vh] w-full flex-col ${widthClass} rounded-2xl border border-gold/20 bg-surface shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gold/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-gold-light">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-gold/10 bg-surface px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
