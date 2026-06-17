import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import AttachmentIcon from '@mui/icons-material/Attachment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeIcon from '@mui/icons-material/Code';
import { PageHeader } from '../components/PageHeader';
import { archiveEmail, deleteEmail, generateReply, getEmail, saveDraft, sendReply } from '../api/endpoints';
import type { EmailMessage } from '../types';

function stripHtmlFallback(value?: string) {
  if (!value) return '';
  const element = document.createElement('div');
  element.innerHTML = value
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*img[^>]*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|tr|table|li|h[1-6])\s*>/gi, '\n');
  return element.textContent ?? '';
}

function decodeTextEntities(value: string) {
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
}

function isStandaloneTrackingLine(line: string) {
  const cleaned = line.trim();
  return cleaned === '#'
    || /^(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(cleaned)
    || /^\[(?:https?:\/\/)?[^\]]+\](?:\s*(?:https?:\/\/)?\S+)?$/i.test(cleaned);
}

function removeTrailingTrackingHost(line: string) {
  const trimmed = line.trim();
  const withoutHost = trimmed.replace(/\s+(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?$/i, '').trim();
  return withoutHost.length >= 6 ? withoutHost : trimmed;
}

function cleanNewsletterLines(value: string) {
  const seen = new Map<string, number>();
  const lines = value
    .split('\n')
    .map((line) => removeTrailingTrackingHost(line.replace(/\s+/g, ' ').trim()))
    .filter((line) => line && !isStandaloneTrackingLine(line));

  return lines.filter((line) => {
    const key = line.toLowerCase().replace(/\W+/g, ' ').trim();
    if (!key) return false;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count < 2;
  }).join('\n');
}

function cleanEmailBody(value?: string) {
  const rawText = /<\/?[a-z][\s\S]*>/i.test(value ?? '') ? stripHtmlFallback(value) : (value ?? '');
  const text = decodeTextEntities(rawText)
    .replace(/\r/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/&zwnj;|&zwj;|&#8204;|&#8205;|&#x200c;|&#x200d;/gi, '')
    .replace(/\[(https?:\/\/[^\]\s]+)\]\s*\1/gi, '$1')
    .replace(/\[(https?:\/\/[^\]\s]+)\]\s*(https?:\/\/\S+)/gi, '$2')
    .replace(/^\s*(image|logo|banner|spacer|tracking pixel)\s*$/gim, '')
    .replace(/^\s*[-_]{4,}\s*$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  return cleanNewsletterLines(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function displayUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Open link';
  }
}

function extractLinks(body?: string) {
  const matches = Array.from((body ?? '').matchAll(/https?:\/\/[^\s<>"\])]+/gi)).map((match) => match[0]);
  const unique = Array.from(new Set(matches));
  return unique.slice(0, 6).map((url) => {
    try {
      const parsed = new URL(url);
      return {
        url,
        host: parsed.hostname.replace(/^www\./, ''),
        title: parsed.pathname.split('/').filter(Boolean).slice(0, 2).join(' / ') || parsed.hostname.replace(/^www\./, '')
      };
    } catch {
      return { url, host: 'Link', title: 'Open link' };
    }
  });
}

function EmailBody({ body }: { body?: string }) {
  const cleaned = cleanEmailBody(body);
  const blocks = cleaned.split(/\n{2,}/).filter(Boolean);
  if (!blocks.length) return <Typography color="text.secondary">No readable email body found.</Typography>;

  return (
    <Stack spacing={1.4}>
      {blocks.map((block, blockIndex) => (
        <Typography key={blockIndex} sx={{ lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {block.split(/(https?:\/\/\S+)/g).map((part, index) => {
            if (!/^https?:\/\//i.test(part)) return <span key={index}>{part}</span>;
            const cleanUrl = part.replace(/[),.;]+$/, '');
            return (
              <Box
                key={index}
                component="a"
                href={cleanUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ color: 'primary.main', fontWeight: 800, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {displayUrl(cleanUrl)}
              </Box>
            );
          })}
        </Typography>
      ))}
    </Stack>
  );
}

export function EmailDetailPage() {
  const { id } = useParams();
  const [email, setEmail] = useState<EmailMessage | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (id) getEmail(id).then(setEmail);
  }, [id]);

  async function createDraft() {
    if (!id) return;
    const response = await generateReply(id);
    setDraft(response.draft);
  }

  async function sendApprovedReply() {
    if (!email) return;
    await sendReply({ threadId: email.threadId, to: email.sender, subject: email.subject, body: draft });
    setConfirmOpen(false);
    setNotice('Reply sent.');
  }

  if (!email) return <PageHeader title="Email" subtitle="Loading message..." />;
  const links = extractLinks(`${email.body ?? ''}\n${email.originalBody ?? ''}`);
  const hasOriginalHtml = /<\/?[a-z][\s\S]*>/i.test(email.originalBody ?? email.body ?? '');

  return (
    <>
      <PageHeader title={email.subject} subtitle={email.sender} />
      <Stack spacing={2.5}>
        {notice && <Alert severity="success">{notice}</Alert>}
        <Card className="premium-panel">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
              <Box>
                <Typography color="text.secondary" variant="body2">{email.date}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 750 }}>{email.sender}</Typography>
              </Box>
              {email.unread && <Chip size="small" label="Unread" color="primary" />}
              {email.accountEmail && <Chip size="small" label={email.accountEmail} variant="outlined" />}
            </Stack>
            <EmailBody body={email.body} />
            {links.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Links in this email</Typography>
                <Grid container spacing={1.25}>
                  {links.map((link) => (
                    <Grid item xs={12} sm={6} key={link.url}>
                      <Box
                        component="a"
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          color: 'inherit',
                          display: 'flex',
                          gap: 1,
                          p: 1.25,
                          textDecoration: 'none',
                          transition: 'background 160ms ease, transform 160ms ease',
                          '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateY(-1px)' } }
                        }}
                      >
                        <OpenInNewIcon color="primary" fontSize="small" />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>{link.title}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>{link.host}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
            {!!email.attachments?.length && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                {email.attachments.map((attachment) => (
                  <Chip key={attachment.attachmentId} icon={<AttachmentIcon />} label={attachment.filename} variant="outlined" />
                ))}
              </Stack>
            )}
            {hasOriginalHtml && (
              <Button sx={{ mt: 2 }} variant="outlined" startIcon={<CodeIcon />} onClick={() => setOriginalOpen(true)}>
                View original HTML
              </Button>
            )}
          </CardContent>
        </Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={createDraft}>{draft ? 'Regenerate Reply' : 'Generate AI Reply'}</Button>
          <Button variant="outlined" startIcon={<ArchiveIcon />} onClick={() => archiveEmail(email.id)}>Archive</Button>
          <Button color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={() => deleteEmail(email.id)}>Delete</Button>
        </Stack>
        <Card className="premium-panel">
          <CardContent>
            <Stack spacing={1.5}>
              <TextField
                label="Editable reply draft"
                multiline
                minRows={8}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Generate or write a reply. Nothing is sent until you approve it."
                sx={{ '& .MuiOutlinedInput-root': { alignItems: 'flex-start' } }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button disabled={!draft} variant="outlined" startIcon={<SaveIcon />} onClick={() => saveDraft(email.id, { threadId: email.threadId, subject: email.subject, body: draft })}>Save Draft</Button>
                <Button disabled={!draft} variant="contained" startIcon={<SendIcon />} onClick={() => setConfirmOpen(true)}>Send Reply</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Send this reply?</DialogTitle>
        <DialogContent>
          <Typography>This will send the edited draft in the original Gmail thread. Please confirm before sending.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={sendApprovedReply}>Send</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={originalOpen} onClose={() => setOriginalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Original email HTML</DialogTitle>
        <DialogContent>
          <Box component="pre" className="scroll-thin" sx={{ bgcolor: '#0f172a', color: '#e5edf8', borderRadius: 2, fontSize: '0.78rem', maxHeight: 520, overflow: 'auto', p: 2, whiteSpace: 'pre-wrap' }}>
            {email.originalBody ?? email.body}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOriginalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
