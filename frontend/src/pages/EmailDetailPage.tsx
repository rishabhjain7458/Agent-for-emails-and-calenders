import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, ButtonGroup, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField, Typography } from '@mui/material';
import DOMPurify from 'dompurify';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeIcon from '@mui/icons-material/Code';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PageHeader } from '../components/PageHeader';
import { archiveEmail, deleteEmail, generateReply, getEmail, getEmailAttachment, refineReply, saveDraft, sendReply } from '../api/endpoints';
import type { EmailMessage } from '../types';

type ReplyRefinementMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const replyRefinementPrompts = [
  'Make it concise',
  'Make it more professional',
  'Make it warmer',
  'Make it firm but polite',
  'Add a clear next step',
  'Remove unnecessary details'
];

function actionErrorMessage(err: any, fallback: string) {
  return err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? fallback;
}

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

function sanitizeEmailHtml(value?: string, allowRemoteImages = false) {
  if (!value) return '';
  const parser = new DOMParser();
  const sanitized = DOMPurify.sanitize(value, {
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['srcset']
  });
  const doc = parser.parseFromString(sanitized, 'text/html');
  if (!allowRemoteImages) {
    doc.querySelectorAll('img[src]').forEach((node) => {
      node.setAttribute('data-blocked-src', node.getAttribute('src') ?? '');
      node.removeAttribute('src');
      node.setAttribute('alt', node.getAttribute('alt') || 'Remote image blocked');
    });
  }
  doc.querySelectorAll('a[href]').forEach((node) => {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noreferrer noopener');
  });
  const style = doc.createElement('style');
  style.textContent = `
    html, body { margin: 0; padding: 0; background: #ffffff; color: #202124; font-family: Arial, Helvetica, sans-serif; }
    body { overflow-wrap: anywhere; }
    img { max-width: 100% !important; height: auto !important; }
    img:not([src]) { display: inline-block; min-height: 32px; min-width: 120px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; }
    table { max-width: 100% !important; }
    a { color: #1a73e8; }
    pre { white-space: pre-wrap; }
  `;
  doc.head.appendChild(style);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function formatAttachmentSize(size?: number) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(mimeType?: string) {
  if (mimeType?.includes('pdf')) return <PictureAsPdfIcon color="error" />;
  if (mimeType?.startsWith('image/')) return <ImageIcon color="primary" />;
  return <InsertDriveFileIcon color="action" />;
}

function canPreviewAttachment(mimeType?: string) {
  return Boolean(mimeType?.startsWith('image/') || mimeType?.includes('pdf') || mimeType?.startsWith('text/'));
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

function RichEmailBody({ html, text }: { html?: string; text?: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(620);
  const [mode, setMode] = useState('text');
  const [showRemoteImages, setShowRemoteImages] = useState(false);
  const srcDoc = useMemo(() => sanitizeEmailHtml(html, showRemoteImages), [html, showRemoteImages]);
  const hasHtml = Boolean(srcDoc);

  function resizeFrame() {
    try {
      const doc = iframeRef.current?.contentDocument;
      const nextHeight = Math.min(Math.max(doc?.documentElement.scrollHeight ?? 620, 460), 2800);
      setHeight(nextHeight);
    } catch {
      setHeight(720);
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }} gap={1} flexWrap="wrap">
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800 }}>Message</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {mode === 'rich' && hasHtml && (
            <Button size="small" variant="outlined" onClick={() => setShowRemoteImages((current) => !current)}>
              {showRemoteImages ? 'Block images' : 'Show images'}
            </Button>
          )}
          <ButtonGroup size="small" variant="outlined">
            <Button disabled={!hasHtml} variant={mode === 'rich' ? 'contained' : 'outlined'} onClick={() => setMode('rich')}>Rich view</Button>
            <Button variant={mode === 'text' ? 'contained' : 'outlined'} onClick={() => setMode('text')}>Clean text</Button>
          </ButtonGroup>
        </Stack>
      </Stack>
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {mode === 'rich' && hasHtml ? (
          <Box
            component="iframe"
            ref={iframeRef}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={srcDoc}
            onLoad={resizeFrame}
            title="Email body"
            sx={{ border: 0, display: 'block', minHeight: 460, width: '100%', height }}
          />
        ) : (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <EmailBody body={text} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function EmailDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState<EmailMessage | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineMessages, setRefineMessages] = useState<ReplyRefinementMessage[]>([]);
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    if (id) getEmail(id).then(setEmail);
  }, [id]);

  async function createDraft() {
    if (!id) return;
    const response = await generateReply(id);
    setDraft(response.draft);
    setRefineMessages([]);
  }

  async function refineDraft(instruction = refineInstruction) {
    if (!id || !draft.trim() || !instruction.trim()) return;
    const nextInstruction = instruction.trim();
    setRefining(true);
    setRefineInstruction('');
    setRefineMessages((current) => [...current, { role: 'user', content: nextInstruction }]);
    try {
      const response = await refineReply(id, { draft, instruction: nextInstruction });
      setDraft(response.draft);
      setRefineMessages((current) => [...current, { role: 'assistant', content: 'Updated the draft.' }]);
    } finally {
      setRefining(false);
    }
  }

  async function sendApprovedReply() {
    if (!email) return;
    setActionBusy('send');
    setError('');
    try {
      await sendReply({ messageId: email.id, threadId: email.threadId, to: email.sender, subject: email.subject, body: draft });
      setConfirmOpen(false);
      setNotice('Reply sent.');
    } catch (err: any) {
      setError(actionErrorMessage(err, 'Could not send the reply.'));
    } finally {
      setActionBusy('');
    }
  }

  async function archiveCurrentEmail() {
    if (!email) return;
    setActionBusy('archive');
    setError('');
    try {
      await archiveEmail(email.id);
      setNotice('Email archived.');
      navigate('/emails', { replace: true });
    } catch (err: any) {
      setError(actionErrorMessage(err, 'Could not archive this email.'));
    } finally {
      setActionBusy('');
    }
  }

  async function deleteCurrentEmail() {
    if (!email) return;
    setActionBusy('delete');
    setError('');
    try {
      await deleteEmail(email.id);
      setNotice('Email deleted.');
      navigate('/emails', { replace: true });
    } catch (err: any) {
      setError(actionErrorMessage(err, 'Could not delete this email.'));
    } finally {
      setActionBusy('');
    }
  }

  async function openAttachment(attachment: NonNullable<EmailMessage['attachments']>[number], preview = false) {
    if (!email) return;
    const blob = await getEmailAttachment(email.id, attachment.attachmentId);
    const url = URL.createObjectURL(new Blob([blob], { type: attachment.mimeType || blob.type || 'application/octet-stream' }));
    if (preview) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename || 'attachment';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  if (!email) return <PageHeader title="Email" subtitle="Loading message..." />;
  const links = extractLinks(`${email.body ?? ''}\n${email.originalBody ?? ''}`);
  const hasOriginalHtml = /<\/?[a-z][\s\S]*>/i.test(email.originalBody ?? email.body ?? '');

  return (
    <>
      <PageHeader title={email.subject} subtitle={email.sender} />
      <Stack spacing={2.5}>
        {notice && <Alert severity="success">{notice}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Card className="premium-panel" sx={{ maxWidth: 980, mx: 'auto', width: '100%' }}>
          <CardContent>
            <Stack spacing={2.25}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>{email.subject}</Typography>
                  <Typography color="text.secondary" variant="body2">{email.date}</Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {email.unread && <Chip size="small" label="Unread" color="primary" />}
                  {email.accountEmail && <Chip size="small" label={email.accountEmail} variant="outlined" />}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}>
                <Box sx={{ bgcolor: 'primary.main', borderRadius: '50%', color: '#fff', display: 'grid', flex: '0 0 auto', fontWeight: 850, height: 38, placeItems: 'center', width: 38 }}>
                  {(email.sender || 'M').trim()[0]?.toUpperCase()}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{email.sender}</Typography>
                  <Typography variant="caption" color="text.secondary">to me</Typography>
                </Box>
              </Stack>
              <RichEmailBody html={email.originalBody} text={email.body} />
              {!!email.attachments?.length && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Attachments</Typography>
                  <Grid container spacing={1.25}>
                    {email.attachments.map((attachment) => (
                      <Grid item xs={12} sm={6} key={attachment.attachmentId}>
                        <Box sx={{ alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', gap: 1.25, p: 1.25 }}>
                          {attachmentIcon(attachment.mimeType)}
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>{attachment.filename}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{attachment.mimeType || 'Attachment'} {formatAttachmentSize(attachment.size)}</Typography>
                          </Box>
                          {canPreviewAttachment(attachment.mimeType) && (
                            <Button size="small" startIcon={<VisibilityIcon />} onClick={() => openAttachment(attachment, true)}>View</Button>
                          )}
                          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => openAttachment(attachment)}>Download</Button>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
              {links.length > 0 && (
                <Box>
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
                            alignItems: 'center',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            color: 'inherit',
                            display: 'flex',
                            gap: 1.25,
                            p: 1.25,
                            textDecoration: 'none',
                            transition: 'background 160ms ease, transform 160ms ease',
                            '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateY(-1px)' } }
                          }}
                        >
                          <Box sx={{ bgcolor: 'primary.light', borderRadius: 1.5, color: 'primary.main', display: 'grid', flex: '0 0 auto', height: 38, placeItems: 'center', width: 38 }}>
                            <LinkIcon />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>{link.title}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{link.host}</Typography>
                          </Box>
                          <OpenInNewIcon color="primary" fontSize="small" />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
              {hasOriginalHtml && (
                <Button sx={{ alignSelf: 'flex-start' }} variant="outlined" startIcon={<CodeIcon />} onClick={() => setOriginalOpen(true)}>
                  View original HTML
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ maxWidth: 980, mx: 'auto', width: '100%' }}>
          <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={createDraft}>{draft ? 'Regenerate Reply' : 'Generate AI Reply'}</Button>
          <Button disabled={!!actionBusy} variant="outlined" startIcon={<ArchiveIcon />} onClick={archiveCurrentEmail}>{actionBusy === 'archive' ? 'Archiving...' : 'Archive'}</Button>
          <Button disabled={!!actionBusy} color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={deleteCurrentEmail}>{actionBusy === 'delete' ? 'Deleting...' : 'Delete'}</Button>
        </Stack>
        <Card className="premium-panel" sx={{ maxWidth: 980, mx: 'auto', width: '100%' }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label="Editable reply draft"
                multiline
                minRows={8}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Generate or write a reply. Nothing is sent until you approve it."
                sx={{ '& .MuiOutlinedInput-root': { alignItems: 'flex-start' } }}
              />
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', p: { xs: 1.25, sm: 1.5 } }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Tailor this reply</Typography>
                      <Typography variant="body2" color="text.secondary">Ask AI to rewrite the current draft before you save or send.</Typography>
                    </Box>
                    <Chip icon={<AutoAwesomeIcon />} label="Draft assistant" color="primary" variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {replyRefinementPrompts.map((prompt) => (
                      <Button key={prompt} size="small" variant="outlined" disabled={!draft || refining} onClick={() => refineDraft(prompt)}>
                        {prompt}
                      </Button>
                    ))}
                  </Stack>
                  {refineMessages.length > 0 && (
                    <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }} className="scroll-thin">
                      {refineMessages.slice(-6).map((message, index) => (
                        <Box
                          key={`${message.role}-${index}`}
                          sx={{
                            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                            bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                            border: message.role === 'assistant' ? '1px solid' : 0,
                            borderColor: 'divider',
                            borderRadius: 2,
                            color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                            maxWidth: '82%',
                            px: 1.25,
                            py: 0.85
                          }}
                        >
                          <Typography variant="body2">{message.content}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      value={refineInstruction}
                      onChange={(event) => setRefineInstruction(event.target.value)}
                      placeholder="Tell AI how to change it, e.g. make it shorter and more confident"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          refineDraft();
                        }
                      }}
                    />
                    <Button disabled={!draft || !refineInstruction.trim() || refining} variant="contained" startIcon={<AutoAwesomeIcon />} onClick={() => refineDraft()}>
                      {refining ? 'Updating...' : 'Update'}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
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
          <Typography>This will send the edited draft from the same mailbox where the message was received. Please confirm before sending.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button disabled={actionBusy === 'send'} variant="contained" onClick={sendApprovedReply}>{actionBusy === 'send' ? 'Sending...' : 'Send'}</Button>
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
