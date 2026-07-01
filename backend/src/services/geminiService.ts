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
      const message = String(error?.message ?? error?.error?.message ?? '');
      if (status === 403 && /api key.*leaked|reported as leaked/i.test(message)) {
        throw new HttpError(403, 'The Gemini API key is blocked because Google reported it as leaked. Create a new Gemini API key, update it in Settings or backend/.env, then restart the backend.');
      }
      if (status === 403 || status === 'PERMISSION_DENIED') {
        throw new HttpError(403, 'Gemini rejected the configured API key. Check that the key is valid, unrestricted for the Gemini API, and saved correctly in Settings or backend/.env.');
      }
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
      'Never mark timezone as missing; use the provided user timezone when the user does not specify one.',
      'If the user gives only a start time for a meeting, set endTime to 30 minutes after startTime instead of asking a clarification.',
      'If the user says "with NAME", make the title "Meeting with NAME" unless a better subject is explicitly provided.',
      'If required calendar fields are missing or ambiguous after those defaults, list them in missing. Required calendar fields are date and startTime.',
      'For task_create return: {"title":"","dueDate":null,"missing":[]}.',
      'For email_search and email_summary return an inbox-scoped query by default: {"query":"in:inbox","missing":[]}. Only use in:sent if the user explicitly asks for sent emails.',
      'For general_question return: {"missing":[]}.'
    ].join(' '),
    message
  );
  return parseJsonObject(text);
}

export async function generateEmailSummary(tenantId: string, userId: string, emails: EmailMessage[]) {
  if (!emails.length) {
    return [
      'Email summary',
      '',
      'Status: No emails found for that request.',
      '',
      'Next step: Try a wider date range or a simpler search.'
    ].join('\n');
  }

  return generateText(
    tenantId,
    userId,
    [
      'Summarize important emails as an executive assistant.',
      'Use plain text section labels and dash bullets. Do not use markdown bold markers, tables, or code fences.',
      'Use this readable format:',
      'Email summary',
      'Overview: one short sentence with count and time range if dates are available.',
      'Priority items:',
      '- Date - Sender - Subject: action, deadline, risk, or why it matters.',
      'Other notes:',
      '- Date - Sender - Subject: useful context.',
      'Next steps:',
      '- Practical action the user can take.',
      'Include email dates when available.',
      'If an email date is missing, say Date unavailable.',
      'Prioritize security alerts, financial notifications, work emails, and meeting invitations. Ignore promotions and marketing.'
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

export async function extractMeetingFromEmail(tenantId: string, userId: string, email: EmailMessage, timezone: string) {
  const now = new Date().toISOString();
  const text = await generateText(
    tenantId,
    userId,
    [
      'Analyze this email and create a calendar event draft only if the email implies a meeting, appointment, deadline call, interview, visit, webinar, class, reminder, or scheduled discussion.',
      `Current ISO time: ${now}. User timezone: ${timezone}. Resolve relative dates using this timezone.`,
      'Return only valid JSON with this shape: {"title":"","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","timezone":"","description":"","attendees":[],"confidence":0.8,"reason":"","missing":[]}.',
      'Use 24-hour HH:mm. If only a start time is present, use a 30 minute duration. If no exact time is present but there is a date, choose 09:00 to 09:30 and mention that assumption in reason.',
      'Use a short human title. Put useful context, sender, and source email subject in description. Include only valid email addresses in attendees.',
      'Never put timezone in missing; use the provided timezone. If date is missing, include date in missing. If no meeting-like intent exists, set confidence below 0.35 and explain in reason.'
    ].join(' '),
    JSON.stringify({
      subject: email.subject,
      sender: email.sender,
      date: email.date,
      snippet: email.snippet,
      body: email.body?.slice(0, 6000)
    })
  );
  return parseJsonObject(text);
}

export async function generateEmailReply(tenantId: string, userId: string, email: EmailMessage, tone = 'professional') {
  return generateText(
    tenantId,
    userId,
    `Draft an email reply in a ${tone} tone. Never claim the reply has been sent. The user must approve before sending.`,
    JSON.stringify(email)
  );
}

export async function refineEmailReply(tenantId: string, userId: string, email: EmailMessage, draft: string, instruction: string) {
  return generateText(
    tenantId,
    userId,
    [
      'Rewrite the current email reply draft according to the user instruction.',
      'Return only the final email reply body, no commentary, no markdown fences, no labels.',
      'Preserve factual accuracy from the original email and current draft.',
      'Do not invent commitments, dates, attachments, or claims.',
      'Never claim the reply has been sent. The user must approve before sending.'
    ].join(' '),
    JSON.stringify({
      instruction,
      originalEmail: email,
      currentDraft: draft
    })
  );
}

export async function answerGeneralQuestion(tenantId: string, userId: string, message: string) {
  return generateText(
    tenantId,
    userId,
    [
      'You are an executive productivity assistant.',
      'Give useful, specific answers with clear formatting.',
      'Use this shape when appropriate: Summary, Details, Next steps.',
      'Use exact dates and times when the user asks about schedules or relative dates.',
      'If information is unavailable, say what is missing and what to try next.',
      'Use plain text headings and dash bullets. Do not use markdown bold markers or code fences.'
    ].join(' '),
    message
  );
}
