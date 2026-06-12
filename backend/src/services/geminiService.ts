import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { getSettings } from '../repositories/settingsRepository.js';
import { HttpError } from '../utils/http.js';
import type { AssistantIntent, EmailMessage } from '../types.js';

const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

async function clientFor(tenantId: string, userId: string) {
  const settings = await getSettings(tenantId, userId);
  const apiKey = settings.gemini_api_key || env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(400, 'Gemini API key is not configured. Add GEMINI_API_KEY to backend/.env or save it in Settings.');
  }
  return new GoogleGenAI({ apiKey });
}

async function generateText(tenantId: string, userId: string, systemInstruction: string, contents: string) {
  const ai = await clientFor(tenantId, userId);
  const models = [env.GEMINI_MODEL, ...fallbackModels].filter((value, index, all) => value && all.indexOf(value) === index);

  let lastError: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction
        }
      });
      return response.text ?? '';
    } catch (error: any) {
      lastError = error;
      const status = error?.status ?? error?.code ?? error?.error?.code;
      if (status !== 503 && status !== 'UNAVAILABLE') throw error;
    }
  }

  throw lastError;
}

function parseIntent(text: string): AssistantIntent {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as AssistantIntent;
  } catch {
    return { intent: 'general_question', confidence: 0.3, parameters: {} };
  }
}

export async function classifyIntent(tenantId: string, userId: string, message: string): Promise<AssistantIntent> {
  const text = await generateText(
    tenantId,
    userId,
    [
      'Classify the user request into one supported intent.',
      'Supported intents: calendar_create, calendar_check, calendar_delete, email_summary, email_search, task_create, task_list, general_question.',
      'Return only valid JSON with this shape: {"intent":"general_question","confidence":0.9,"parameters":{}}.',
      'Do not include markdown fences.'
    ].join(' '),
    message
  );
  return parseIntent(text);
}

export async function generateEmailSummary(tenantId: string, userId: string, emails: EmailMessage[]) {
  return generateText(
    tenantId,
    userId,
    [
      'Summarize important emails concisely in plain text only.',
      'Do not use Markdown, asterisks, bold markers, tables, or code fences.',
      'Use this readable format:',
      'Overview: one short sentence.',
      'Priority items:',
      '- Sender - subject: action or risk.',
      'Other notes:',
      '- Sender - subject: useful context.',
      'Keep spacing between sections. Prioritize security alerts, financial notifications, work emails, and meeting invitations. Ignore promotions and marketing.'
    ].join(' '),
    JSON.stringify(emails.slice(0, 20))
  );
}

export async function generateSingleEmailSummary(tenantId: string, userId: string, email: EmailMessage) {
  return generateText(
    tenantId,
    userId,
    'Summarize this email in one concise sentence. Focus on sender intent, deadline, risk, or requested action.',
    JSON.stringify(email)
  );
}

export async function generateEmailReply(tenantId: string, userId: string, email: EmailMessage, tone = 'professional') {
  return generateText(
    tenantId,
    userId,
    `Draft an email reply in a ${tone} tone. Never claim the reply has been sent. The user must approve before sending.`,
    JSON.stringify(email)
  );
}

export async function answerGeneralQuestion(tenantId: string, userId: string, message: string) {
  return generateText(
    tenantId,
    userId,
    'You are an executive productivity assistant. Be concise and action-oriented. Use plain text only, without Markdown bold markers or asterisks.',
    message
  );
}
