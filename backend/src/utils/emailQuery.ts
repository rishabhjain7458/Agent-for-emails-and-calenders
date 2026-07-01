export function normalizeInboxQuery(query: string, message = query) {
  const raw = (query || '').trim();
  const source = `${raw} ${message}`.toLowerCase();
  const explicitlySent = /\bin:sent\b|\bsent emails?\b|\bemails? i sent\b|\bmail i sent\b|\bi sent\b/.test(source);
  const hasMailboxScope = /\bin:(inbox|sent|trash|spam|drafts|all|anywhere)\b/.test(raw.toLowerCase());
  const wantsUnread = /\bunread\b|\bnot read\b/.test(source);
  const wantsPriority = /\b(priority|important|urgent|critical|security|financial|finance|work|meeting)\b/.test(source);
  const additions = [
    wantsUnread && !/\bis:unread\b/i.test(raw) ? 'is:unread' : '',
    wantsPriority && !/\b(category:primary|is:important)\b/i.test(raw) ? 'category:primary' : ''
  ].filter(Boolean).join(' ');

  if (explicitlySent) return hasMailboxScope ? `${raw} ${additions}`.trim() : `in:sent ${raw} ${additions}`.trim();
  if (hasMailboxScope) return `${raw.replace(/\bin:(all|anywhere)\b/gi, 'in:inbox')} ${additions}`.trim();
  return `in:inbox ${raw} ${additions}`.trim();
}
