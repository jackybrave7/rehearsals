import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Copy, Mail, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminErrorBanner } from '../components/admin/adminUi';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Select, Textarea } from '../components/FormFields';
import { DripFullEmailEditor } from '../components/admin/DripFullEmailEditor';
import { dripBodyHtmlFromPlainText, plainTextFromHtml } from '../../shared/dripEmailBody';
import { isFullDripEmailDocument, wrapFullDripEmailHtml } from '../../shared/dripEmailDocument';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import {
  createAdminDripStep,
  deleteAdminDripStep,
  duplicateAdminDripStep,
  fetchAdminOnboardingDrip,
  sendAdminDripTestEmail,
  updateAdminDripStep,
  updateAdminOnboardingDripSettings,
  type EmailDripStepDto,
  type EmailDripStepInput,
  type DripStepEngagementStats,
  type OnboardingDripOverview,
} from '../api/adminOnboardingDrip';

function resolveFullDripHtml(input: {
  bodyHtml: string | null;
  bodyText: string;
  actionLabel: string;
  actionPath: string;
}): string {
  const trimmed = input.bodyHtml?.trim();
  if (trimmed && isFullDripEmailDocument(trimmed)) return trimmed;
  const inner =
    trimmed && !isFullDripEmailDocument(trimmed)
      ? trimmed
      : dripBodyHtmlFromPlainText(input.bodyText, { leadFirst: true });
  return wrapFullDripEmailHtml({
    innerBodyHtml: inner,
    actionLabel: input.actionLabel,
    actionPath: input.actionPath,
  });
}

function delayLabel(step: EmailDripStepDto): string {
  const parts: string[] = [];
  if (step.delayDays) parts.push(`${step.delayDays} д`);
  if (step.delayHours) parts.push(`${step.delayHours} ч`);
  if (step.delayMinutes) parts.push(`${step.delayMinutes} мин`);
  return parts.length ? parts.join(' ') : '0 мин';
}

function conditionSummary(step: EmailDripStepDto, meta: OnboardingDripOverview['meta']): string {
  const typeLabel =
    meta.conditionTypes.find((t) => t.value === step.conditionType)?.label ?? step.conditionType;
  if (step.conditionType === 'always') return typeLabel;
  const checklist =
    meta.checklistSteps.find((c) => c.id === step.conditionChecklistStep)?.label ??
    step.conditionChecklistStep ??
    '—';
  return `${typeLabel}: «${checklist}»`;
}

function emptyStepInput(meta: OnboardingDripOverview['meta']): EmailDripStepInput {
  const actionLabel = 'Открыть приложение';
  const actionPath = meta.actionPaths[0]?.value ?? '/app';
  const bodyText = 'Текст для plain-text версии. Пустая строка между абзацами.';
  return {
    title: 'Новое письмо',
    enabled: true,
    sortOrder: 0,
    conditionType: 'checklist_pending',
    conditionChecklistStep: meta.checklistSteps[0]?.id ?? 'theater',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Тема письма — Репетиции',
    bodyText,
    bodyHtml: resolveFullDripHtml({ bodyHtml: null, bodyText, actionLabel, actionPath }),
    bodyFormat: 'html',
    actionLabel,
    actionPath,
  };
}

function stepToInput(step: EmailDripStepDto): EmailDripStepInput {
  const actionLabel = step.actionLabel;
  const actionPath = step.actionPath;
  return {
    title: step.title,
    enabled: step.enabled,
    sortOrder: step.sortOrder,
    conditionType: step.conditionType,
    conditionChecklistStep: step.conditionChecklistStep,
    delayDays: step.delayDays,
    delayHours: step.delayHours,
    delayMinutes: step.delayMinutes,
    subject: step.subject,
    bodyText: step.bodyText,
    bodyHtml: resolveFullDripHtml({
      bodyHtml: step.bodyHtml,
      bodyText: step.bodyText,
      actionLabel,
      actionPath,
    }),
    bodyFormat: 'html',
    actionLabel,
    actionPath,
  };
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function AdminOnboardingDripPage() {
  const { confirm } = useConfirmDialog();
  const [data, setData] = useState<OnboardingDripOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmailDripStepInput | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  const previewAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rehears.ru';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchAdminOnboardingDrip());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedSteps = useMemo(
    () => [...(data?.steps ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [data?.steps]
  );

  const patchSettings = async (patch: { enabled?: boolean; includeLegacyUsers?: boolean }) => {
    setSaving(true);
    setError('');
    try {
      const result = await updateAdminOnboardingDripSettings(patch);
      setData((prev) => (prev ? { ...prev, settings: result.settings } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    if (!data) return;
    setEditingId(null);
    setForm(emptyStepInput(data.meta));
    setTestNotice(null);
    setEditorOpen(true);
  };

  const openEdit = (step: EmailDripStepDto) => {
    setEditingId(step.id);
    setForm(stepToInput(step));
    setTestNotice(null);
    setEditorOpen(true);
  };

  const saveStep = async () => {
    if (!form || !form.bodyHtml?.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload: EmailDripStepInput = {
        ...form,
        bodyFormat: 'html',
        bodyHtml: form.bodyHtml.trim(),
        bodyText: form.bodyText.trim() || plainTextFromHtml(form.bodyHtml),
      };
      if (editingId) {
        await updateAdminDripStep(editingId, payload);
      } else {
        await createAdminDripStep(payload);
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить шаг');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (step: EmailDripStepDto) => {
    setError('');
    try {
      await updateAdminDripStep(step.id, { enabled: !step.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const onDuplicate = async (id: string) => {
    setError('');
    try {
      await duplicateAdminDripStep(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const sendTestEmail = async () => {
    if (!form?.bodyHtml?.trim()) return;
    setTestSending(true);
    setTestNotice(null);
    setError('');
    try {
      const payload: EmailDripStepInput = {
        ...form,
        bodyFormat: 'html',
        bodyHtml: form.bodyHtml.trim(),
        bodyText: form.bodyText.trim() || plainTextFromHtml(form.bodyHtml),
      };
      const result = await sendAdminDripTestEmail({
        ...payload,
        stepId: editingId ?? undefined,
      });
      setTestNotice(`Тест отправлен на ${result.sentTo}`);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'MAIL_NOT_CONFIGURED') {
        setError('SMTP не настроен на сервере — тест недоступен.');
      } else if (code === 'MISSING_FIELDS') {
        setError('Заполните тему и текст письма перед тестом.');
      } else {
        setError('Не удалось отправить тест. Проверьте SMTP и логи сервера.');
      }
    } finally {
      setTestSending(false);
    }
  };

  const onDelete = async (step: EmailDripStepDto) => {
    const ok = await confirm({
      title: 'Удалить письмо из цепочки?',
      message: `«${step.title}» — статистика отправок по этому шагу тоже удалится.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAdminDripStep(step.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const engagementByStep = useMemo(() => {
    const map = new Map<string, DripStepEngagementStats>();
    for (const row of data?.engagement.steps ?? []) {
      map.set(row.stepId, row);
    }
    return map;
  }, [data?.engagement.steps]);

  const settings = data?.settings;
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <AdminNav />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Цепочка писем</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Настраиваемые письма онбординга. Отдельно от ручных рассылок.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Обновить
          </Button>
          <Button onClick={openCreate} disabled={!data}>
            <Plus size={16} />
            Добавить письмо
          </Button>
        </div>
      </header>

      {error && <AdminErrorBanner error={error} />}

      {data && !data.mailConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          SMTP не настроен — письма не отправляются.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold/15 bg-surface/30 p-4">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(settings?.enabled)}
            disabled={saving}
            onChange={(e) => void patchSettings({ enabled: e.target.checked })}
          />
          <span>
            <span className="block font-medium text-white">Включить цепочку</span>
            <span className="mt-1 block text-sm text-muted">По умолчанию выключено.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold/15 bg-surface/30 p-4">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(settings?.includeLegacyUsers)}
            disabled={saving || !settings?.enabled}
            onChange={(e) => void patchSettings({ includeLegacyUsers: e.target.checked })}
          />
          <span>
            <span className="block font-medium text-white">Ранее зарегистрированные</span>
            <span className="mt-1 block text-sm text-muted">
              Включать пользователей до даты запуска цепочки.
            </span>
          </span>
        </label>
      </section>

      {settings?.launchedAt && (
        <p className="text-sm text-muted">
          Запуск:{' '}
          <span className="text-white">
            {format(parseISO(settings.launchedAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
          </span>
          {' · '}
          <Mail size={14} className="mr-1 inline" />
          Отправлено: <strong className="text-white">{data?.stats.totalSent ?? 0}</strong>
        </p>
      )}

      {data?.engagement && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gold/15 bg-surface/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Доставлено</p>
            <p className="mt-1 text-2xl font-semibold text-white">{data.engagement.totalDeliveries}</p>
          </div>
          <div className="rounded-xl border border-gold/15 bg-surface/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Открытия</p>
            <p className="mt-1 text-2xl font-semibold text-sky-300">{data.engagement.totalOpens}</p>
            <p className="text-xs text-muted">
              уник.: {data.engagement.uniqueOpens}
              {data.engagement.totalDeliveries > 0
                ? ` · ${pct(data.engagement.uniqueOpens / data.engagement.totalDeliveries)}`
                : ''}
            </p>
          </div>
          <div className="rounded-xl border border-gold/15 bg-surface/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Клики</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{data.engagement.totalClicks}</p>
            <p className="text-xs text-muted">уник.: {data.engagement.uniqueClicks}</p>
          </div>
          <div className="rounded-xl border border-gold/15 bg-surface/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Авто-отправок (всего)</p>
            <p className="mt-1 text-2xl font-semibold text-white">{data.stats.totalSent}</p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Письма цепочки</h2>
        {sortedSteps.length === 0 && (
          <p className="text-sm text-muted">Нет шагов — нажмите «Добавить письмо» или перезапустите API для seed.</p>
        )}
        {sortedSteps.map((step) => (
          <div
            key={step.id}
            className={`rounded-xl border p-4 ${step.enabled ? 'border-gold/20 bg-surface/25' : 'border-gold/10 bg-surface/10 opacity-75'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{step.title}</span>
                  {!step.enabled && (
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">выкл</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{step.subject}</p>
                <p className="mt-2 text-xs text-muted">
                  Задержка: {delayLabel(step)} · {meta ? conditionSummary(step, meta) : ''} · отправок:{' '}
                  {step.sentCount}
                  {engagementByStep.get(step.id) ? (
                    <>
                      {' '}
                      · открытий: {engagementByStep.get(step.id)!.opens} (
                      {pct(engagementByStep.get(step.id)!.openRate)}) · кликов:{' '}
                      {engagementByStep.get(step.id)!.clicks}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" className="!px-2" onClick={() => void toggleEnabled(step)} title="Вкл/выкл">
                  {step.enabled ? 'Выкл' : 'Вкл'}
                </Button>
                <Button variant="ghost" className="!px-2" onClick={() => openEdit(step)} title="Редактировать">
                  <Pencil size={16} />
                </Button>
                <Button variant="ghost" className="!px-2" onClick={() => void onDuplicate(step.id)} title="Копировать">
                  <Copy size={16} />
                </Button>
                <Button variant="ghost" className="!px-2" onClick={() => void onDelete(step)} title="Удалить">
                  <Trash2 size={16} className="text-red-300" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {form && meta && (
        <Modal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          title={editingId ? 'Редактирование письма' : 'Новое письмо'}
          wide
          xl
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                Отмена
              </Button>
              <Button
                variant="secondary"
                disabled={!data?.mailConfigured || testSending || !form.bodyHtml?.trim()}
                onClick={() => void sendTestEmail()}
              >
                {testSending ? 'Отправка…' : 'Тест на мой email'}
              </Button>
              <Button onClick={() => void saveStep()} disabled={saving}>
                Сохранить
              </Button>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Input
                label="Название (для админки)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Input
                label="Тема письма"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Дней"
                  type="number"
                  min={0}
                  value={form.delayDays ?? 0}
                  onChange={(e) => setForm({ ...form, delayDays: Number(e.target.value) })}
                />
                <Input
                  label="Часов"
                  type="number"
                  min={0}
                  value={form.delayHours ?? 0}
                  onChange={(e) => setForm({ ...form, delayHours: Number(e.target.value) })}
                />
                <Input
                  label="Минут"
                  type="number"
                  min={0}
                  value={form.delayMinutes ?? 0}
                  onChange={(e) => setForm({ ...form, delayMinutes: Number(e.target.value) })}
                />
              </div>
              <p className="text-xs text-muted">
                После предыдущего письма цепочки (или после подтверждения email для первого подходящего
                шага).
              </p>
              <Select
                label="Условие отправки"
                value={form.conditionType ?? 'checklist_pending'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    conditionType: e.target.value as EmailDripStepInput['conditionType'],
                  })
                }
                options={meta.conditionTypes.map((t) => ({ value: t.value, label: t.label }))}
              />
              {form.conditionType !== 'always' && (
                <Select
                  label="Шаг чек-листа"
                  value={form.conditionChecklistStep ?? ''}
                  onChange={(e) => setForm({ ...form, conditionChecklistStep: e.target.value })}
                  options={meta.checklistSteps.map((c) => ({ value: c.id, label: c.label }))}
                />
              )}
              <Input
                label="Порядок"
                type="number"
                value={form.sortOrder ?? 0}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
              <Input
                label="Текст кнопки"
                value={form.actionLabel ?? ''}
                onChange={(e) => setForm({ ...form, actionLabel: e.target.value })}
              />
              <Select
                label="Ссылка кнопки"
                value={form.actionPath ?? '/app'}
                onChange={(e) => setForm({ ...form, actionPath: e.target.value })}
                options={meta.actionPaths.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            <div className="space-y-3 lg:col-span-2">
              {testNotice && <p className="text-sm text-green-300">{testNotice}</p>}
              <Textarea
                label="Текст для почтовых клиентов без HTML"
                rows={4}
                value={form.bodyText}
                onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
              />
              <DripFullEmailEditor
                html={form.bodyHtml ?? ''}
                appUrl={previewAppUrl}
                actionLabel={form.actionLabel ?? 'Открыть приложение'}
                actionPath={form.actionPath ?? '/app'}
                onChange={(bodyHtml) => setForm({ ...form, bodyHtml })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
