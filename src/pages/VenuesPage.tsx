import { useState } from 'react';
import { MapPin, Plus, Pencil } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { generateId } from '../utils/id';
import type { Venue } from '../types';
import { getTheaterVenues } from '../store/selectors';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea } from '../components/FormFields';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

const emptyVenue = (): Omit<Venue, 'id'> => ({
  name: '',
  address: '',
  notes: '',
});

export function VenuesPage() {
  const { state, dispatch } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState(emptyVenue());
  const venues = getTheaterVenues(state);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyVenue());
    setModalOpen(true);
  };

  const openEdit = (venue: Venue) => {
    setEditing(venue);
    setForm({ ...venue });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      dispatch({ type: 'UPDATE_VENUE', payload: { ...form, id: editing.id, theaterId: editing.theaterId } });
    } else {
      dispatch({ type: 'ADD_VENUE', payload: { ...form, id: generateId(), theaterId: state.activeTheaterId ?? undefined } });
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Удалить площадку?',
      message: 'Площадка будет удалена из списка. Репетиции сохранят текст адреса, если он был указан вручную.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_VENUE', payload: id });
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Площадки</h1>
          <p className="mt-1 text-muted">Репетиционные площадки и залы</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Добавить
        </Button>
      </header>

      {venues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Пока нет площадок. Добавьте первую репетиционную площадку.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="group rounded-2xl border border-gold/10 bg-surface/60 overflow-hidden"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <MapPin size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">{venue.name}</h3>
                  {venue.address && (
                    <p className="mt-1 text-sm text-muted">{venue.address}</p>
                  )}
                </div>
              </div>
              {venue.notes && (
                <p className="border-t border-gold/10 px-5 py-3 text-sm text-muted">{venue.notes}</p>
              )}
              <div className="card-actions flex min-h-10 gap-2 border-t border-gold/10 px-5 py-3">
                <Button variant="ghost" className="!px-2 !py-1" onClick={() => openEdit(venue)}>
                  <Pencil size={16} />
                </Button>
                <DeleteButton label="Удалить площадку" onClick={() => handleDelete(venue.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактировать площадку' : 'Новая площадка'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Библиотека №90 им. Неверова"
          />
          <Input
            label="Адрес"
            value={form.address ?? ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Москва, м. Выхино, ул. Молдагуловой, 3Б"
          />
          <Textarea
            label="Заметки"
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
