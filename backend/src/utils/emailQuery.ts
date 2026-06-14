export function normalizeInboxQuery(query: string, message = query) {
  const raw = (query || '').trim();
  const source = `${raw} ${message}`.toLowerCase();
  const explicitlySent = /\bin:sent\b|\bsent emails?\b|\bemails? i sent\b|\bmail i sent\b|\bi sent\b/.test(source);
  const hasMailboxScope = /\bin:(inbox|sent|trash|spam|drafts|all|anywhere)\b/.test(raw.toLowerCase());

  if (explicitlySent) return hasMailboxScope ? raw : `in:sent ${raw}`.trim();
  if (hasMailboxScope) return raw.replace(/\bin:(all|anywhere)\b/gi, 'in:inbox');
  return `in:inbox ${raw}`.trim();
}
