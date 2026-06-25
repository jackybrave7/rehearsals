import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';

type DialogVariant = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
}

export interface AlertOptions {
  title: string;
  message: string;
  okLabel?: string;
}

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmDeleteOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Слово для подтверждения, по умолчанию «удалить» */
  confirmWord?: string;
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDelete: (options: ConfirmDeleteOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | {
      kind: 'confirmDelete';
      options: ConfirmDeleteOptions & { confirmWord: string };
      value: string;
      openId: number;
      resolve: (value: boolean) => void;
    }
  | { kind: 'alert'; options: AlertOptions; resolve: () => void }
  | {
      kind: 'prompt';
      options: PromptOptions;
      value: string;
      openId: number;
      resolve: (value: string | null) => void;
    };

const DEFAULT_DELETE_WORD = 'удалить';

function matchesDeleteWord(value: string, confirmWord: string): boolean {
  return value.trim().toLowerCase() === confirmWord.toLowerCase();
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogOpenIdRef = useRef(0);

  const dialogOpenId =
    dialog?.kind === 'prompt' || dialog?.kind === 'confirmDelete' ? dialog.openId : null;

  useEffect(() => {
    if (dialog?.kind !== 'prompt' && dialog?.kind !== 'confirmDelete') return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      if (dialog.kind === 'prompt') {
        inputRef.current?.select();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dialog?.kind, dialogOpenId]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ kind: 'confirm', options, resolve });
    });
  }, []);

  const confirmDelete = useCallback((options: ConfirmDeleteOptions) => {
    return new Promise<boolean>((resolve) => {
      dialogOpenIdRef.current += 1;
      setDialog({
        kind: 'confirmDelete',
        options: { confirmWord: DEFAULT_DELETE_WORD, ...options },
        value: '',
        openId: dialogOpenIdRef.current,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setDialog({ kind: 'alert', options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      dialogOpenIdRef.current += 1;
      setDialog({
        kind: 'prompt',
        options,
        value: options.defaultValue ?? '',
        openId: dialogOpenIdRef.current,
        resolve,
      });
    });
  }, []);

  const closeDialog = () => setDialog(null);

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') {
      dialog.resolve(true);
    } else if (dialog.kind === 'confirmDelete') {
      if (!matchesDeleteWord(dialog.value, dialog.options.confirmWord)) return;
      dialog.resolve(true);
    } else if (dialog.kind === 'alert') {
      dialog.resolve();
    } else {
      const trimmed = dialog.value.trim();
      dialog.resolve(trimmed || null);
    }
    closeDialog();
  };

  const handleCancel = () => {
    if (!dialog) return;
    if (dialog.kind === 'confirm' || dialog.kind === 'confirmDelete') {
      dialog.resolve(false);
    } else if (dialog.kind === 'prompt') {
      dialog.resolve(null);
    }
    closeDialog();
  };

  const handlePromptSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleConfirm();
  };

  const handleDeleteSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleConfirm();
  };

  const handleBackdropClick = () => {
    if (!dialog) return;
    if (dialog.kind === 'alert') {
      handleConfirm();
      return;
    }
    handleCancel();
  };

  useEffect(() => {
    if (!dialog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (dialog.kind === 'alert') {
        handleConfirm();
      } else {
        handleCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog]);

  const isDanger =
    dialog?.kind === 'confirm' && dialog.options.variant === 'danger';

  const deleteWordMatches =
    dialog?.kind === 'confirmDelete' &&
    matchesDeleteWord(dialog.value, dialog.options.confirmWord);

  return (
    <ConfirmDialogContext.Provider value={{ confirm, confirmDelete, alert, prompt }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            className="app-dialog relative w-full max-w-md rounded-2xl border border-gold/20 bg-surface shadow-2xl"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isDanger || dialog.kind === 'confirmDelete'
                      ? 'bg-red-500/15 text-red-300'
                      : 'bg-gold/10 text-gold'
                  }`}
                >
                  {isDanger || dialog.kind === 'confirmDelete' ? (
                    <AlertTriangle size={20} />
                  ) : (
                    <Info size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="app-dialog-title"
                    className="text-lg font-semibold leading-snug text-gold-light"
                  >
                    {dialog.options.title}
                  </h2>
                  {'message' in dialog.options && dialog.options.message && (
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {dialog.options.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {dialog.kind === 'prompt' ? (
              <form onSubmit={handlePromptSubmit} className="px-6 pb-6 pt-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={dialog.value}
                  onChange={(event) =>
                    setDialog({ ...dialog, value: event.target.value })
                  }
                  placeholder={dialog.options.placeholder}
                  className="app-dialog-input w-full rounded-xl border border-gold/20 bg-background/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-gold/40"
                />
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    {dialog.options.cancelLabel ?? 'Отмена'}
                  </Button>
                  <Button type="submit">
                    {dialog.options.confirmLabel ?? 'Сохранить'}
                  </Button>
                </div>
              </form>
            ) : dialog.kind === 'confirmDelete' ? (
              <form onSubmit={handleDeleteSubmit} className="px-6 pb-6 pt-4">
                <label className="block text-sm text-muted">
                  Введите{' '}
                  <span className="font-mono font-medium text-foreground">
                    {dialog.options.confirmWord}
                  </span>{' '}
                  для подтверждения
                  <input
                    ref={inputRef}
                    type="text"
                    value={dialog.value}
                    onChange={(event) =>
                      setDialog({ ...dialog, value: event.target.value })
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="app-dialog-input mt-2 w-full rounded-xl border border-gold/20 bg-background/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-gold/40"
                  />
                </label>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    {dialog.options.cancelLabel ?? 'Отмена'}
                  </Button>
                  <Button type="submit" variant="danger" disabled={!deleteWordMatches}>
                    {dialog.options.confirmLabel ?? 'Удалить'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap justify-end gap-2 px-6 pb-6 pt-5">
                {dialog.kind === 'confirm' && (
                  <Button variant="secondary" onClick={handleCancel}>
                    {dialog.options.cancelLabel ?? 'Отмена'}
                  </Button>
                )}
                <Button
                  variant={isDanger ? 'danger' : 'primary'}
                  onClick={handleConfirm}
                >
                  {dialog.kind === 'alert'
                    ? dialog.options.okLabel ?? 'Понятно'
                    : dialog.options.confirmLabel ?? 'Подтвердить'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}
