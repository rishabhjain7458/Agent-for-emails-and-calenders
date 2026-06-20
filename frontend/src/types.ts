export type User = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  provider?: 'google' | 'microsoft' | 'zoho' | 'imap';
};

export type EmailMessage = {
  id: string;
  threadId: string;
  accountId?: string;
  accountEmail?: string;
  provider?: 'google' | 'microsoft' | 'zoho' | 'imap';
  subject: string;
  sender: string;
  date: string;
  unread: boolean;
  snippet?: string;
  body?: string;
  originalBody?: string;
  attachments?: { filename: string; mimeType: string; attachmentId: string; size?: number }[];
};

export type ConnectedAccount = {
  id: string;
  provider: 'google' | 'microsoft' | 'zoho' | 'imap';
  email: string;
  name?: string;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  due_date?: string;
  status: 'pending' | 'needsAction' | 'completed';
  provider?: 'google' | 'microsoft' | 'zoho' | 'imap';
  account_id?: string;
  account_email?: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  subject?: string;
  eventType?: string;
  isAllDay?: boolean;
  showAs?: string;
  categories?: string[];
  accountId?: string;
  accountEmail?: string;
  provider?: 'google' | 'microsoft' | 'zoho' | 'imap';
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export type AssistantConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type AssistantConversation = {
  id: string;
  title: string;
  messages: AssistantConversationMessage[];
  created_at: string;
  updated_at: string;
};

export type DashboardCard = {
  id: string;
  cardType: 'social' | 'news' | 'custom_link' | 'portal' | 'media';
  platform?: 'instagram' | 'facebook' | string | null;
  label: string;
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
