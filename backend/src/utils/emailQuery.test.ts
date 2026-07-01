import { describe, expect, it } from 'vitest';
import { normalizeInboxQuery } from './emailQuery.js';

describe('normalizeInboxQuery', () => {
  it('defaults searches to inbox', () => {
    expect(normalizeInboxQuery('from:john@example.com')).toBe('in:inbox from:john@example.com');
  });

  it('keeps sent-mail searches in sent scope', () => {
    expect(normalizeInboxQuery('from:john@example.com', 'show emails I sent to John')).toBe('in:sent from:john@example.com');
  });

  it('adds unread and primary filters for priority unread summaries', () => {
    expect(normalizeInboxQuery('newer_than:14d', 'summarize unread priority emails')).toBe('in:inbox newer_than:14d is:unread category:primary');
  });

  it('does not duplicate existing Gmail operators', () => {
    expect(normalizeInboxQuery('in:inbox is:unread category:primary', 'unread priority emails')).toBe('in:inbox is:unread category:primary');
  });
});
