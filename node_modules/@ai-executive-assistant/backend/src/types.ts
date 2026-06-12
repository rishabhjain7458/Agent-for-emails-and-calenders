export type AuthUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  provider: 'google' | 'microsoft';
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

export type IntentName =
  | 'calendar_create'
  | 'calendar_check'
  | 'calendar_delete'
  | 'email_summary'
  | 'email_search'
  | 'task_create'
  | 'task_list'
  | 'general_question';

export type AssistantIntent = {
  intent: IntentName;
  confidence: number;
  parameters: Record<string, unknown>;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
