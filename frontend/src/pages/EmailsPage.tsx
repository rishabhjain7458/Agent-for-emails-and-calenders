import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, Grid, LinearProgress, Stack, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import DraftsIcon from '@mui/icons-material/Drafts';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { WindowedList } from '../components/WindowedList';
import { archiveEmail, createEvent, createMeetingDraftFromEmail, createTask, deleteEmail, getEmails, setEmailUnreadState } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { EmailMessage } from '../types';

const savedSearchKey = 'o-connect-email-saved-searches';

const emailFilters = [
  { label: 'Inbox', query: 'in:inbox', helper: 'All inbox mail' },
  { label: 'Unread', query: 'in:inbox is:unread', helper: 'Needs attention' },
  { label: 'Important', query: 'in:inbox is:important', helper: 'Marked important' },
  { label: 'Attachments', query: 'in:inbox has:attachment', helper: 'Files included' },
  { label: 'This week', query: 'in:inbox newer_than:7d', helper: 'Recent inbox' },
  { label: 'Sent', query: 'in:sent', helper: 'Sent mail' },
  { label: 'Has PDF', query: 'in:inbox filename:pdf', helper: 'PDF files' },
  { label: 'Last 24h', query: 'in:inbox newer_than:1d', helper: 'Newest mail' },
  { label: 'Needs reply', query: 'in:inbox is:unread', helper: 'Unread follow-up' },
  { label: 'Promos hidden', query: 'in:inbox -category:promotions', helper: 'Cleaner inbox' },
  { label: 'From boss', query: 'in:inbox from:boss', helper: 'Edit sender' }
];

const queryOperators = [
  'is:unread',
  'has:attachment',
  'newer_than:7d',
  'older_than:30d',
  'from:',
  'to:',
  'subject:',
  'filename:pdf',
  'larger:5M'
];

function actionErrorMessage(err: any, fallback: string) {
  return err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? fallback;
}

function emailPriorityScore(email: EmailMessage) {
  const haystack = `${email.sender} ${email.subject} ${email.snippet}`.toLowerCase();
  let score = email.unread ? 35 : 15;
  if (/\b(security|verify|alert|urgent|invoice|payment|bank|meeting|calendar|contract|approval|deadline)\b/.test(haystack)) score += 35;
  if (email.attachments?.length) score += 10;
  if (!/no-?reply|newsletter|promo|marketing|updates/i.test(haystack)) score += 15;
  return Math.min(score, 100);
}

export function EmailsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { activeSpaceId, activeSpace, isCombined, setActiveSpaceId } = useSpace();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') || 'in:inbox';
  const [query, setQuery] = useState(initialQuery);
  const [senderSearch, setSenderSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [bodySearch, setBodySearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [savedSearchName, setSavedSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState<{ name: string; query: string }[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [limit, setLimit] = useState(24);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [busyEmailId, setBusyEmailId] = useState('');
  const [meetingDraft, setMeetingDraft] = useState<Awaited<ReturnType<typeof createMeetingDraftFromEmail>> | null>(null);
  const [meetingCreating, setMeetingCreating] = useState(false);
  const [taskDraft, setTaskDraft] = useState<{ email: EmailMessage; title: string; dueDate: string; accountId: string } | null>(null);
  const [taskCreating, setTaskCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load(q = query, nextLimit = limit) {
    setLoading(true);
    try {
      setEmails(await getEmails(q, isCombined ? 'all' : activeSpaceId, nextLimit));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSavedSearches(JSON.parse(localStorage.getItem(savedSearchKey) ?? '[]'));
    load(initialQuery);
  }, []);

  useEffect(() => {
    const nextQuery = searchParams.get('query');
    const nextAccountId = searchParams.get('accountId');
    if (nextQuery && nextQuery !== query) {
      setQuery(nextQuery);
      load(nextQuery);
    }
    if (nextAccountId) {
      setActiveSpaceId(nextAccountId === 'all' ? 'combined' : nextAccountId);
    }
  }, [searchParams]);

  useEffect(() => {
    load(query);
  }, [activeSpaceId, isCombined]);

  function applyFilter(nextQuery: string) {
    setLimit(24);
    setQuery(nextQuery);
    load(nextQuery, 24);
  }

  function quoteSearchValue(value: string) {
    const cleaned = value.trim().replace(/"/g, '\\"');
    if (!cleaned) return '';
    return /\s/.test(cleaned) ? `"${cleaned}"` : cleaned;
  }

  function buildFieldQuery() {
    const parts = [query.trim() || 'in:inbox'];
    const sender = quoteSearchValue(senderSearch);
    const subject = quoteSearchValue(subjectSearch);
    const body = quoteSearchValue(bodySearch);

    if (sender) parts.push(`from:${sender}`);
    if (subject) parts.push(`subject:${subject}`);
    if (body) parts.push(body);
    if (dateFrom) parts.push(`after:${dateFrom.replace(/-/g, '/')}`);
    if (dateTo) parts.push(`before:${dateTo.replace(/-/g, '/')}`);

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function searchWithFields() {
    const nextQuery = buildFieldQuery();
    setLimit(24);
    setQuery(nextQuery);
    load(nextQuery, 24);
  }

  function clearFieldSearch() {
    setSenderSearch('');
    setSubjectSearch('');
    setBodySearch('');
    setDateFrom('');
    setDateTo('');
    setLimit(24);
    setQuery('in:inbox');
    load('in:inbox', 24);
  }

  async function loadMore() {
    const nextLimit = limit + 24;
    setLimit(nextLimit);
    setLoading(true);
    try {
      setEmails(await getEmails(query, isCombined ? 'all' : activeSpaceId, nextLimit));
    } finally {
      setLoading(false);
    }
  }

  function saveCurrentSearch() {
    const nextQuery = buildFieldQuery();
    const name = savedSearchName.trim() || nextQuery;
    const next = [{ name, query: nextQuery }, ...savedSearches.filter((item) => item.query !== nextQuery)].slice(0, 8);
    setSavedSearches(next);
    setSavedSearchName('');
    localStorage.setItem(savedSearchKey, JSON.stringify(next));
  }

  function appendOperator(operator: string) {
    setQuery((current) => `${current} ${operator}`.replace(/\s+/g, ' ').trim());
  }

  async function handleEmailSwipe(email: EmailMessage, deltaX: number) {
    if (Math.abs(deltaX) < 80) return;
    setActionError('');
    setEmails((current) => current.filter((item) => item.id !== email.id));
    try {
      if (deltaX > 0) await archiveEmail(email.id);
      else await deleteEmail(email.id);
    } catch (err: any) {
      setEmails((current) => [email, ...current.filter((item) => item.id !== email.id)]);
      setActionError(actionErrorMessage(err, 'Could not update that email.'));
    }
  }

  async function handleDeleteEmail(email: EmailMessage) {
    setActionError('');
    setActionNotice('');
    setBusyEmailId(email.id);
    const previous = emails;
    setEmails((current) => current.filter((item) => item.id !== email.id));
    try {
      await deleteEmail(email.id);
      setActionNotice('Email deleted.');
    } catch (err: any) {
      setEmails(previous);
      setActionError(actionErrorMessage(err, 'Could not delete that email.'));
    } finally {
      setBusyEmailId('');
    }
  }

  async function handleToggleUnread(email: EmailMessage) {
    const nextUnread = !email.unread;
    setActionError('');
    setActionNotice('');
    setBusyEmailId(email.id);
    setEmails((current) => current.map((item) => item.id === email.id ? { ...item, unread: nextUnread } : item));
    try {
      await setEmailUnreadState(email.id, nextUnread);
      setActionNotice(nextUnread ? 'Email marked unread.' : 'Email marked read.');
    } catch (err: any) {
      setEmails((current) => current.map((item) => item.id === email.id ? { ...item, unread: email.unread } : item));
      setActionError(actionErrorMessage(err, 'Could not update read state for that email.'));
    } finally {
      setBusyEmailId('');
    }
  }

  async function handleCreateMeetingDraft(email: EmailMessage) {
    setActionError('');
    setActionNotice('');
    setBusyEmailId(email.id);
    try {
      setMeetingDraft(await createMeetingDraftFromEmail(email.id));
    } catch (err: any) {
      setActionError(actionErrorMessage(err, 'Could not analyze that email for a meeting.'));
    } finally {
      setBusyEmailId('');
    }
  }

  function handleCreateTaskFromEmail(email: EmailMessage) {
    setActionError('');
    setActionNotice('');
    setTaskDraft({
      email,
      title: `Follow up: ${email.subject}`,
      dueDate: '',
      accountId: email.accountId ?? 'primary'
    });
  }

  async function confirmMeetingCreate() {
    if (!meetingDraft) return;
    setMeetingCreating(true);
    setActionError('');
    setActionNotice('');
    try {
      await createEvent({
        ...meetingDraft.draft,
        accountId: meetingDraft.accountId,
        force: false
      });
      setActionNotice(`Meeting created on ${meetingDraft.accountEmail}.`);
      setMeetingDraft(null);
    } catch (err: any) {
      setActionError(actionErrorMessage(err, 'Could not create the meeting. Check the draft and try again.'));
    } finally {
      setMeetingCreating(false);
    }
  }

  async function confirmTaskCreate() {
    if (!taskDraft) return;
    if (!taskDraft.title.trim()) {
      setActionError('Add a task title before creating it.');
      return;
    }

    setTaskCreating(true);
    setActionError('');
    setActionNotice('');
    try {
      await createTask({
        title: taskDraft.title.trim(),
        dueDate: taskDraft.dueDate || undefined,
        accountId: taskDraft.accountId
      });
      setTaskDraft(null);
      setActionNotice('Task created from email.');
    } catch (err: any) {
      setActionError(actionErrorMessage(err, 'Could not create a task from that email.'));
    } finally {
      setTaskCreating(false);
    }
  }

  const filterContent = (
    <Stack spacing={2.2}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Quick filters</Typography>
        <Grid container spacing={1}>
          {emailFilters.map((filter) => (
            <Grid item xs={6} key={filter.query}>
              <Button
                fullWidth
                variant={query === filter.query ? 'contained' : 'outlined'}
                onClick={() => {
                  applyFilter(filter.query);
                  if (isMobile) setFilterOpen(false);
                }}
                sx={{ alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: 58, px: 1.25, py: 0.9 }}
              >
                <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                  <Typography component="span" sx={{ display: 'block', fontWeight: 850, lineHeight: 1.1 }}>{filter.label}</Typography>
                  <Typography component="span" sx={{ display: 'block', fontSize: '0.72rem', opacity: 0.75, lineHeight: 1.2, mt: 0.35 }}>{filter.helper}</Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>
      </Box>
      {savedSearches.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Saved searches</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {savedSearches.map((saved) => (
              <Chip key={saved.query} label={saved.name} onClick={() => applyFilter(saved.query)} onDelete={() => {
                const next = savedSearches.filter((item) => item.query !== saved.query);
                setSavedSearches(next);
                localStorage.setItem(savedSearchKey, JSON.stringify(next));
              }} />
            ))}
          </Stack>
        </Box>
      )}
      <Alert severity="info">Space: {isCombined ? 'Combined workspace' : activeSpace?.email ?? 'Selected account'}</Alert>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Search by text</Typography>
        <Stack spacing={1.25}>
          <TextField label="Sender" value={senderSearch} onChange={(event) => setSenderSearch(event.target.value)} placeholder="name@example.com or sender name" />
          <TextField label="Subject contains" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="invoice, project update, approval" />
          <TextField label="Body contains" value={bodySearch} onChange={(event) => setBodySearch(event.target.value)} placeholder="words inside the email body" />
        </Stack>
      </Box>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Date range</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField fullWidth label="From" type="date" value={dateFrom} InputLabelProps={{ shrink: true }} onChange={(event) => setDateFrom(event.target.value)} />
          <TextField fullWidth label="To" type="date" value={dateTo} InputLabelProps={{ shrink: true }} onChange={(event) => setDateTo(event.target.value)} />
        </Stack>
      </Box>
      <TextField label="Advanced mail query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="in:inbox from:name@example.com newer_than:7d" helperText="Use common mail operators. The fields above are added when you search." />
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Query operators</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {queryOperators.map((operator) => (
            <Chip key={operator} label={operator} variant="outlined" onClick={() => appendOperator(operator)} sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
          ))}
        </Stack>
      </Box>
      <TextField label="Save search as" value={savedSearchName} onChange={(event) => setSavedSearchName(event.target.value)} placeholder="Invoices this month" />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button fullWidth variant="contained" startIcon={<SearchIcon />} onClick={() => {
          searchWithFields();
          if (isMobile) setFilterOpen(false);
        }}>Search</Button>
        <Button variant="outlined" startIcon={<SaveIcon />} onClick={saveCurrentSearch}>Save</Button>
        <Button variant="outlined" onClick={clearFieldSearch}>Clear</Button>
      </Stack>
    </Stack>
  );

  const desktopFilterContent = (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Quick filters</Typography>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          {emailFilters.map((filter) => (
            <Button
              size="small"
              key={filter.query}
              variant={query === filter.query ? 'contained' : 'outlined'}
              onClick={() => applyFilter(filter.query)}
              sx={{ minHeight: 34, px: 1.2, borderRadius: 999 }}
            >
              {filter.label}
            </Button>
          ))}
        </Stack>
      </Box>
      {savedSearches.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Saved searches</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {savedSearches.map((saved) => (
              <Chip key={saved.query} label={saved.name} onClick={() => applyFilter(saved.query)} onDelete={() => {
                const next = savedSearches.filter((item) => item.query !== saved.query);
                setSavedSearches(next);
                localStorage.setItem(savedSearchKey, JSON.stringify(next));
              }} />
            ))}
          </Stack>
        </Box>
      )}
      <Grid container spacing={1.25} alignItems="flex-start">
        <Grid item xs={12} md={2.5}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.25, py: 0.9, bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Searching</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 850 }}>{isCombined ? 'Combined workspace' : activeSpace?.email ?? 'Selected account'}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField size="small" fullWidth label="Sender" value={senderSearch} onChange={(event) => setSenderSearch(event.target.value)} placeholder="name@example.com" />
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField size="small" fullWidth label="Subject contains" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="invoice, approval" />
        </Grid>
        <Grid item xs={12} sm={4} md={3.5}>
          <TextField size="small" fullWidth label="Body contains" value={bodySearch} onChange={(event) => setBodySearch(event.target.value)} placeholder="words inside email" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField size="small" fullWidth label="From date" type="date" value={dateFrom} InputLabelProps={{ shrink: true }} onChange={(event) => setDateFrom(event.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField size="small" fullWidth label="To date" type="date" value={dateTo} InputLabelProps={{ shrink: true }} onChange={(event) => setDateTo(event.target.value)} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField size="small" fullWidth label="Advanced mail query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="in:inbox from:name@example.com newer_than:7d" />
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField size="small" fullWidth label="Save as" value={savedSearchName} onChange={(event) => setSavedSearchName(event.target.value)} placeholder="Invoices" />
        </Grid>
        <Grid item xs={12} md={2}>
          <Stack direction="row" spacing={1}>
            <Button size="small" fullWidth variant="contained" startIcon={<SearchIcon />} onClick={searchWithFields}>Search</Button>
            <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={saveCurrentSearch}>Save</Button>
            <Button size="small" variant="outlined" onClick={clearFieldSearch}>Clear</Button>
          </Stack>
        </Grid>
      </Grid>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {queryOperators.map((operator) => (
          <Chip key={operator} label={operator} variant="outlined" onClick={() => appendOperator(operator)} sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
        ))}
      </Stack>
    </Stack>
  );

  return (
    <>
      <PageHeader
        title="Emails"
        subtitle="Search connected inboxes and open clean email details."
      />
      {isMobile && (
        <Button fullWidth variant="contained" startIcon={<FilterAltIcon />} onClick={() => setFilterOpen(true)} sx={{ mb: 1.5 }}>
          Search and filters
        </Button>
      )}
      <Drawer anchor="bottom" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { borderRadius: '12px 12px 0 0', maxHeight: '88vh' } }}>
        <Box className="scroll-thin" sx={{ p: 2, overflowY: 'auto' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Email filters</Typography>
          {filterContent}
        </Box>
      </Drawer>
      <Grid container spacing={2}>
        <Grid item xs={12} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card className="premium-panel">
            <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: '1.08rem' }}>Email Search</Typography>
                  <Typography color="text.secondary" variant="body2">Filter by sender, subject, body, date, or Gmail-style operators.</Typography>
                </Box>
                <Chip size="small" icon={<FilterAltIcon />} label={`${emails.length} results`} color="primary" variant="outlined" />
              </Stack>
              {desktopFilterContent}
            </CardContent>
          </Card>
        </Grid>
        {actionError && (
          <Grid item xs={12}>
            <Alert severity="error">{actionError}</Alert>
          </Grid>
        )}
        {actionNotice && (
          <Grid item xs={12}>
            <Alert severity="success">{actionNotice}</Alert>
          </Grid>
        )}
        <Grid item xs={12}>
          <Card className="premium-panel">
            {loading && <LinearProgress />}
            <CardContent sx={{ p: { xs: 1.25, md: 2 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1.5 }} spacing={1.25}>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: '1.08rem' }}>Inbox Results</Typography>
                  <Typography color="text.secondary" variant="body2">{emails.length} messages in {isCombined ? 'combined workspace' : activeSpace?.email ?? 'selected space'}</Typography>
                </Box>
                <MailOutlineIcon color="primary" />
              </Stack>
              <Stack divider={<Divider flexItem />} spacing={0}>
                <WindowedList
                  items={emails}
                  estimateSize={126}
                  maxVisible={48}
                  renderItem={(email) => (
                    <Box
                key={email.id}
                onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                onTouchEnd={(event) => {
                  if (touchStartX === null) return;
                  const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
                  if (Math.abs(deltaX) >= 80) {
                    event.preventDefault();
                    handleEmailSwipe(email, deltaX);
                  }
                  setTouchStartX(null);
                }}
                sx={{ display: 'block', color: 'inherit', py: 1.15, px: { xs: 0.75, sm: 1 }, borderRadius: 2, transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(3px)' }, boxShadow: 'inset 3px 0 0 #2557d6' } }}
              >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: { xs: 1, md: 1.5 }, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/emails/${encodeURIComponent(email.id)}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') navigate(`/emails/${encodeURIComponent(email.id)}`);
                      }}
                      sx={{ cursor: 'pointer', minWidth: 0, width: '100%' }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap', rowGap: 0.75 }}>
                        {email.unread && <Chip size="small" label="Unread" color="primary" />}
                        {email.accountEmail && (
                          <Chip
                            size="small"
                            label={email.accountEmail}
                            variant="outlined"
                            sx={{ maxWidth: { xs: 190, sm: 260 }, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                          />
                        )}
                        <Chip
                          size="small"
                          label={`AI ${emailPriorityScore(email)}`}
                          color={emailPriorityScore(email) >= 70 ? 'warning' : emailPriorityScore(email) >= 45 ? 'primary' : 'default'}
                          variant={emailPriorityScore(email) >= 70 ? 'filled' : 'outlined'}
                        />
                        <Typography
                          variant="subtitle1"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: { xs: 2, sm: 2 },
                            WebkitBoxOrient: 'vertical',
                            flexBasis: '100%',
                            fontWeight: 800,
                            lineHeight: 1.28,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'normal'
                          }}
                        >
                          {email.subject}
                        </Typography>
                      </Stack>
                      <Typography color="text.secondary" variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.sender}</Typography>
                      {query.startsWith('in:sent') && <Chip size="small" label="Waiting for reply" color="secondary" variant="outlined" sx={{ mt: 0.75 }} />}
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, display: '-webkit-box', WebkitLineClamp: { xs: 2, sm: 2 }, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{email.snippet}</Typography>
                    </Box>
                  <Stack spacing={0.75} alignItems={{ xs: 'stretch', md: 'flex-end' }} sx={{ flex: '0 0 auto', minWidth: { xs: '100%', md: 216 } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'right' }, whiteSpace: { xs: 'normal', sm: 'nowrap' } }}>{email.date}</Typography>
                    <Stack direction="row" spacing={0.75} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap" useFlexGap>
                      <Tooltip title="Delete email">
                        <span>
                          <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} disabled={busyEmailId === email.id} onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteEmail(email);
                          }}>
                            Delete
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={email.unread ? 'Mark as read' : 'Mark as unread'}>
                        <span>
                          <Button size="small" variant="outlined" startIcon={email.unread ? <DraftsIcon /> : <MarkEmailUnreadIcon />} disabled={busyEmailId === email.id} onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleToggleUnread(email);
                          }}>
                            {email.unread ? 'Read' : 'Unread'}
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="Analyze this email and draft a meeting">
                        <span>
                          <Button size="small" variant="contained" startIcon={<AutoAwesomeIcon />} disabled={busyEmailId === email.id} onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleCreateMeetingDraft(email);
                          }}>
                            AI meeting
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="Create a follow-up task">
                        <span>
                          <Button size="small" variant="outlined" startIcon={<TaskAltIcon />} disabled={busyEmailId === email.id} onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleCreateTaskFromEmail(email);
                          }}>
                            Task
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
                    </Box>
                  )}
                />
                {!loading && emails.length === 0 && (
                  <EmptyState
                    icon={<MailOutlineIcon />}
                    title="No emails found"
                    description="Try a broader query, change the selected space, or clear the filters."
                    actionLabel="Clear filters"
                    onAction={clearFieldSearch}
                  />
                )}
              </Stack>
              {emails.length >= limit && (
                <Button fullWidth variant="outlined" onClick={loadMore} disabled={loading} sx={{ mt: 2 }}>
                  {loading ? 'Loading...' : 'Load more emails'}
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Dialog open={Boolean(meetingDraft)} onClose={() => setMeetingDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <EventAvailableIcon color="primary" />
            <Box>
              <Typography variant="h6">Create meeting from email?</Typography>
              <Typography variant="caption" color="text.secondary">
                Calendar: {meetingDraft?.accountEmail ?? 'Selected account'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {meetingDraft && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              {!meetingDraft.canCreate && (
                <Alert severity="warning">
                  I found a possible meeting, but some details need checking: {meetingDraft.draft.missing?.join(', ') || meetingDraft.draft.reason || 'low confidence'}.
                </Alert>
              )}
              <Alert severity="info">{meetingDraft.draft.reason}</Alert>
              <TextField size="small" label="Title" value={meetingDraft.draft.title} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, title: event.target.value } })} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField fullWidth size="small" label="Date" type="date" value={meetingDraft.draft.date} InputLabelProps={{ shrink: true }} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, date: event.target.value, missing: meetingDraft.draft.missing.filter((item) => item !== 'date') } })} />
                <TextField fullWidth size="small" label="Start" type="time" value={meetingDraft.draft.startTime} InputLabelProps={{ shrink: true }} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, startTime: event.target.value, missing: meetingDraft.draft.missing.filter((item) => item !== 'startTime') } })} />
                <TextField fullWidth size="small" label="End" type="time" value={meetingDraft.draft.endTime} InputLabelProps={{ shrink: true }} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, endTime: event.target.value, missing: meetingDraft.draft.missing.filter((item) => item !== 'endTime') } })} />
              </Stack>
              <TextField size="small" label="Timezone" value={meetingDraft.draft.timezone} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, timezone: event.target.value } })} />
              <TextField size="small" label="Attendees" value={meetingDraft.draft.attendees.join(', ')} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, attendees: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } })} />
              <TextField size="small" label="Description" multiline minRows={3} value={meetingDraft.draft.description ?? ''} onChange={(event) => setMeetingDraft({ ...meetingDraft, draft: { ...meetingDraft.draft, description: event.target.value } })} />
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Source email</Typography>
                <Typography sx={{ fontWeight: 850 }}>{meetingDraft.sourceEmail.subject}</Typography>
                <Typography variant="body2" color="text.secondary">{meetingDraft.sourceEmail.sender}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeetingDraft(null)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<EventAvailableIcon />}
            disabled={meetingCreating || meetingDraft?.provider === 'zoho' || meetingDraft?.provider === 'imap' || !meetingDraft?.draft.date || !meetingDraft?.draft.startTime || !meetingDraft?.draft.endTime || !meetingDraft?.draft.title}
            onClick={confirmMeetingCreate}
          >
            {meetingCreating ? 'Creating...' : 'Create meeting'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(taskDraft)} onClose={() => setTaskDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <TaskAltIcon color="primary" />
            <Box>
              <Typography variant="h6">Create task from email?</Typography>
              <Typography variant="caption" color="text.secondary">
                Review the task before it is added.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {taskDraft && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <TextField
                size="small"
                label="Task title"
                value={taskDraft.title}
                onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })}
              />
              <TextField
                size="small"
                label="Due date"
                type="date"
                value={taskDraft.dueDate}
                InputLabelProps={{ shrink: true }}
                helperText="Optional. Leave blank if this does not need a deadline."
                onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })}
              />
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Source email</Typography>
                <Typography sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>{taskDraft.email.subject}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{taskDraft.email.sender}</Typography>
                {taskDraft.email.accountEmail && <Chip size="small" label={taskDraft.email.accountEmail} variant="outlined" sx={{ mt: 1 }} />}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDraft(null)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<TaskAltIcon />}
            disabled={taskCreating || !taskDraft?.title.trim()}
            onClick={confirmTaskCreate}
          >
            {taskCreating ? 'Creating...' : 'Create task'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
