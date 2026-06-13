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

function parseJsonObject(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
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

export async function extractAssistantParameters(tenantId: string, userId: string, intent: AssistantIntent, message: string, timezone: string) {
  const now = new Date().toISOString();
  const text = await generateText(
    tenantId,
    userId,
    [
      'Extract safe structured parameters for the requested productivity action.',
      `Intent: ${intent.intent}. Current ISO time: ${now}. User timezone: ${timezone}.`,
      'Resolve relative dates like today, tomorrow, next Monday using the provided current time and timezone.',
      'Return only valid JSON. Do not include markdown.',
      'For calendar_create return: {"title":"","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","timezone":"","description":"","attendees":[],"missing":[]}.',
      'Use 24-hour HH:mm time. If a person is named without an email address, include the name in title/description but do not put it in attendees.',
      'If required calendar fields are missing or ambiguous, list them in missing. Required calendar fields are title, date, startTime, endTime.',
      'For task_create return: {"title":"","dueDate":null,"missing":[]}.',
      'For email_search and email_summary return: {"query":"in:inbox","missing":[]}.',
      'For general_question return: {"missing":[]}.'
    ].join(' '),
    message
  );
  return parseJsonObject(text);
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
      '- Date - Sender - subject: action or risk.',
      'Other notes:',
      '- Date - Sender - subject: useful context.',
      'Include email dates when available.',
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
