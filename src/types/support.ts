export const SUPPORT_TICKET_CATEGORIES = [
  { value: 'bug', label: 'Ошибка / сбой' },
  { value: 'feature', label: 'Предложение / улучшение' },
  { value: 'billing', label: 'Тариф и оплата' },
  { value: 'account', label: 'Аккаунт и доступ' },
  { value: 'other', label: 'Другое' },
] as const;

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number]['value'];

export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';

export const MAX_SUPPORT_ATTACHMENTS = 5;
export const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export interface SupportTicketAttachment {
  id: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: SupportTicketCategory;
  subject: string | null;
  message: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  attachments: SupportTicketAttachment[];
}

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Новая',
  in_progress: 'В работе',
  closed: 'Закрыта',
};

export function getSupportCategoryLabel(category: SupportTicketCategory): string {
  return SUPPORT_TICKET_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}
