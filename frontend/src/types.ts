export type User = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  provider?: 'google' | 'microsoft';
};

export type EmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  date: string;
  unread: boolean;
  snippet?: string;
  body?: string;
  attachments?: { filename: string; mimeType: string; attachmentId: string }[];
};

export type Task = {
  id: string;
  title: string;
  due_date?: string;
  status: 'pending' | 'needsAction' | 'completed';
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};
