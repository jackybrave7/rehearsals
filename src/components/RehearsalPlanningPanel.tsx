import { useMemo, useState } from 'react';
import { getDay } from 'date-fns';
import { BookmarkPlus, CalendarRange, Wand2 } from 'lucide-react';
import type { Rehearsal, RehearsalSeries } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradePrompt } from './UpgradePrompt';
import { getRehearsalTemplates } from '../store/selectors';
import {
  applyTemplateToRehearsal,
  buildRehearsalsFromSeries,
  createTemplateFromRehearsal,
  getSeriesWeekdayLabel,
} from '../utils/rehearsalPlanning';
import { generateId } from '../utils/id';
import { Button } from './Button';
import { DeleteButton } from './DeleteButton';
import { useConfirmDialog } from './ConfirmDialogContext';
import { Modal } from './Modal';
import { Input, Select } from './FormFields';

interface RehearsalPlanningPanelProps {
  rehearsal: Rehearsal;
}

export function RehearsalPlanningPanel({ rehearsal }: RehearsalPlanningPanelProps) {
  const { state, dispatch } = useRehearsalStore();
  const { isPro } = useSubscription();
  const { confirm } = useConfirmDialog();
  const templates = useMemo(
    () => getRehearsalTemplates(state, state.activeTheaterId),
    [state]
  );

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [seriesForm, setSeriesForm] = useState({
    name: 'Еженедельная репетиция',
    weekday: getDay(parseLocalDate(rehearsal.date)),
    fromDate: rehearsal.date,
    untilDate: '',
    useCurrentPlan: true,
  });

  const saveTemplate = () => {
    const name = templateName.trim() || `Шаблон ${rehearsal.date}`;
    dispatch({
      type: 'ADD_REHEARSAL_TEMPLATE',
      payload: createTemplateFromRehearsal(rehearsal, name, state.activeTheaterId ?? undefined),
    });
    setTemplateModalOpen(false);
    setTemplateName('');
  };

  const applyTemplate = () => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    const applied = applyTemplateToRehearsal(template, rehearsal.startTime);
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: {
        ...rehearsal,
        ...applied,
      },
    });
    setTemplateModalOpen(false);
  };

  const deleteSelectedTemplate = async () => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    const confirmed = await confirm({
      title: `Удалить шаблон «${template.name}»?`,
      message: 'Шаблон будет удалён без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_REHEARSAL_TEMPLATE', payload: template.id });
    setSelectedTemplateId('');
  };

  const createSeries = () => {
    const template = seriesForm.useCurrentPlan
      ? createTemplateFromRehearsal(rehearsal, seriesForm.name, state.activeTheaterId ?? undefined)
      : undefined;
    const series: RehearsalSeries = {
      id: generateId(),
      theaterId: state.activeTheaterId ?? undefined,
      playId: rehearsal.playId,
      performanceId: rehearsal.performanceId,
      venueId: rehearsal.venueId,
      location: rehearsal.location,
      startTime: rehearsal.startTime,
      endTime: rehearsal.endTime,
      weekday: seriesForm.weekday,
      fromDate: seriesForm.fromDate,
      untilDate: seriesForm.untilDate || undefined,
      templateId: template?.id,
      name: seriesForm.name.trim() || undefined,
    };
    const existingDates = new Set(state.rehearsals.map((item) => item.date));
    const rehearsals = buildRehearsalsFromSeries(series, template, existingDates);
    dispatch({
      type: 'ADD_REHEARSAL_SERIES',
      payload: {
        series,
        template,
        rehearsals,
      },
    });
    setSeriesModalOpen(false);
  };

  return (
    <>
      <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Планирование
        </h2>
        {!isPro ? (
          <UpgradePrompt
            compact
            title="Шаблоны и серии — в Pro"
            description="Сохраняйте план репетиции и разворачивайте повторяющееся расписание."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => setTemplateModalOpen(true)}>
              <BookmarkPlus size={15} />
              Шаблон
            </Button>
            <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => setSeriesModalOpen(true)}>
              <CalendarRange size={15} />
              Серия
            </Button>
          </div>
        )}
        {rehearsal.seriesId && (
          <p className="mt-2 text-xs text-muted">Часть повторяющейся серии — дату можно править отдельно.</p>
        )}
      </section>

      {isPro && (
      <>
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title="Шаблон репетиции"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTemplateModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveTemplate}>Сохранить шаблон</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {templates.length > 0 && (
            <Select
              label="Применить шаблон"
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              options={[
                { value: '', label: 'Выберите шаблон' },
                ...templates.map((template) => ({ value: template.id, label: template.name })),
              ]}
            />
          )}
          {selectedTemplateId && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={applyTemplate}>
                <Wand2 size={16} />
                Применить к этой репетиции
              </Button>
              <DeleteButton
                label={`Удалить шаблон «${templates.find((item) => item.id === selectedTemplateId)?.name ?? ''}»`}
                onClick={deleteSelectedTemplate}
              />
            </div>
          )}
          <Input
            label="Сохранить текущий план как"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Суббота: разминка и сцены"
          />
        </div>
      </Modal>

      <Modal open={seriesModalOpen} onClose={() => setSeriesModalOpen(false)} title="Повторяющаяся серия"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSeriesModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={createSeries}>Создать серию</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название серии"
            value={seriesForm.name}
            onChange={(event) => setSeriesForm({ ...seriesForm, name: event.target.value })}
          />
          <Select
            label="День недели"
            value={String(seriesForm.weekday)}
            onChange={(event) =>
              setSeriesForm({ ...seriesForm, weekday: Number(event.target.value) })
            }
            options={[1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
              value: String(weekday),
              label: getSeriesWeekdayLabel(weekday),
            }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="С даты"
              type="date"
              value={seriesForm.fromDate}
              onChange={(event) => setSeriesForm({ ...seriesForm, fromDate: event.target.value })}
            />
            <Input
              label="До даты"
              type="date"
              value={seriesForm.untilDate}
              onChange={(event) => setSeriesForm({ ...seriesForm, untilDate: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={seriesForm.useCurrentPlan}
              onChange={(event) =>
                setSeriesForm({ ...seriesForm, useCurrentPlan: event.target.checked })
              }
            />
            Использовать текущий план как шаблон для каждой даты
          </label>
        </div>
      </Modal>
      </>
      )}
    </>
  );
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}
