import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import AttachmentIcon from '@mui/icons-material/Attachment';
import { PageHeader } from '../components/PageHeader';
import { archiveEmail, deleteEmail, generateReply, getEmail, saveDraft, sendReply } from '../api/endpoints';
import type { EmailMessage } from '../types';

function stripHtmlFallback(value?: string) {
  if (!value) return '';
  if (!/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  const element = document.createElement('div');
  element.innerHTML = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|tr|table|li|h[1-6])\s*>/gi, '\n');
  return (element.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export function EmailDetailPage() {
  const { id } = useParams();
  const [email, setEmail] = useState<EmailMessage | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
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
            <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{stripHtmlFallback(email.body)}</Typography>
            {!!email.attachments?.length && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                {email.attachments.map((attachment) => (
                  <Chip key={attachment.attachmentId} icon={<AttachmentIcon />} label={attachment.filename} variant="outlined" />
                ))}
              </Stack>
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
    </>
  );
}
