import { BookOpen, Building2, Calendar, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { appPaths } from '../navigation/appPaths';
import { Button } from './Button';
import { Modal } from './Modal';

type WelcomeOnboardingModalProps = {
  open: boolean;
  onClose: () => void;
  onCreateTheater: () => void;
};

export function WelcomeOnboardingModal({
  open,
  onClose,
  onCreateTheater,
}: WelcomeOnboardingModalProps) {
  const handleCreate = () => {
    onClose();
    void onCreateTheater();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добро пожаловать в Репетиции"
      wide
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Понятно
          </Button>
          <Button onClick={handleCreate}>Создать первый театр</Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        Сервис помогает вести расписание репетиций, сцены из Google Docs, участников и напоминания в
        Telegram — всё в одном месте.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gold/10 bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-gold-light">
            <Building2 size={18} />
            <span className="text-sm font-medium">Свой коллектив</span>
          </div>
          <p className="text-sm text-muted">
            Создайте театр кнопкой «+ Новый» в боковом меню — вы станете владельцем и сможете сразу
            добавлять постановки и репетиции.
          </p>
        </div>
        <div className="rounded-xl border border-gold/10 bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-gold-light">
            <Users size={18} />
            <span className="text-sm font-medium">Приглашение</span>
          </div>
          <p className="text-sm text-muted">
            Если вас добавят в существующий театр по email, нажмите «Проверить доступ» — права
            появятся автоматически.
          </p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-medium text-foreground">С чего начать</h3>
      <ol className="mt-2 space-y-2 text-sm text-muted">
        <li className="flex gap-2">
          <span className="text-gold">1.</span>
          <span>Создайте театр или дождитесь приглашения от владельца.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-gold">2.</span>
          <span>Добавьте постановку и импортируйте сцены из Google Docs.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-gold">3.</span>
          <span>Запланируйте репетицию и при необходимости подключите Telegram-напоминания.</span>
        </li>
      </ol>

      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <Link
          to={appPaths.guide}
          className="inline-flex items-center gap-1.5 text-gold-light underline-offset-2 hover:underline"
        >
          <BookOpen size={15} />
          Руководство
        </Link>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Calendar size={15} />
          На тарифе Free — один театр и одна активная постановка
        </span>
      </div>
    </Modal>
  );
}
