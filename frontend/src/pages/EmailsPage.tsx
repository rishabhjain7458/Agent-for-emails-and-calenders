import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Drawer, Grid, LinearProgress, Stack, TextField, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SaveIcon from '@mui/icons-material/Save';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { WindowedList } from '../components/WindowedList';
import { archiveEmail, deleteEmail, getEmails, getEmailSummary } from '../api/endpoints';
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

export function EmailsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
  const [summary, setSummary] = useState('');
  const [actionError, setActionError] = useState('');
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
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {emailFilters.map((filter) => (
            <Button
              key={filter.query}
              variant={query === filter.query ? 'contained' : 'outlined'}
              onClick={() => applyFilter(filter.query)}
              sx={{ minHeight: 42, px: 1.5 }}
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
      <Grid container spacing={1.5} alignItems="flex-start">
        <Grid item xs={12} md={3}>
          <Alert severity="info" sx={{ height: '100%', alignItems: 'center' }}>Space: {isCombined ? 'Combined' : activeSpace?.email ?? 'Selected account'}</Alert>
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField fullWidth label="Sender" value={senderSearch} onChange={(event) => setSenderSearch(event.target.value)} placeholder="name@example.com" />
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField fullWidth label="Subject contains" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="invoice, approval" />
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField fullWidth label="Body contains" value={bodySearch} onChange={(event) => setBodySearch(event.target.value)} placeholder="words inside email" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField fullWidth label="From date" type="date" value={dateFrom} InputLabelProps={{ shrink: true }} onChange={(event) => setDateFrom(event.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField fullWidth label="To date" type="date" value={dateTo} InputLabelProps={{ shrink: true }} onChange={(event) => setDateTo(event.target.value)} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth label="Advanced mail query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="in:inbox from:name@example.com newer_than:7d" />
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField fullWidth label="Save as" value={savedSearchName} onChange={(event) => setSavedSearchName(event.target.value)} placeholder="Invoices" />
        </Grid>
        <Grid item xs={12} md={2}>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="contained" startIcon={<SearchIcon />} onClick={searchWithFields}>Search</Button>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={saveCurrentSearch}>Save</Button>
            <Button variant="outlined" onClick={clearFieldSearch}>Clear</Button>
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
        subtitle="Search connected inboxes, summarize important mail, and draft approved replies."
        action={<Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={async () => setSummary(await getEmailSummary())}>AI Summary</Button>}
      />
      {isMobile && (
        <Button fullWidth variant="contained" startIcon={<FilterAltIcon />} onClick={() => setFilterOpen(true)} sx={{ mb: 2 }}>
          Search and filters
        </Button>
      )}
      <Drawer anchor="bottom" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { borderRadius: '12px 12px 0 0', maxHeight: '88vh' } }}>
        <Box className="scroll-thin" sx={{ p: 2, overflowY: 'auto' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Email filters</Typography>
          {filterContent}
        </Box>
      </Drawer>
      <Grid container spacing={2.5}>
        <Grid item xs={12} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card className="premium-panel">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Email Search</Typography>
                  <Typography color="text.secondary" variant="body2">Filter by account, sender, subject, body text, date, or advanced mail operators.</Typography>
                </Box>
                <Chip icon={<FilterAltIcon />} label="Filters" color="primary" variant="outlined" />
              </Stack>
              {desktopFilterContent}
            </CardContent>
          </Card>
        </Grid>
        {summary && (
          <Grid item xs={12}>
            <Alert severity="info">{summary}</Alert>
          </Grid>
        )}
        {actionError && (
          <Grid item xs={12}>
            <Alert severity="error">{actionError}</Alert>
          </Grid>
        )}
        <Grid item xs={12}>
          <Card className="premium-panel">
            {loading && <LinearProgress />}
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1.5 }} spacing={1.25}>
                <Box>
                  <Typography variant="h6">Inbox Results</Typography>
                  <Typography color="text.secondary" variant="body2">{emails.length} messages returned across connected inboxes</Typography>
                </Box>
                <MailOutlineIcon color="primary" />
              </Stack>
              <Stack divider={<Divider flexItem />} spacing={0}>
                <WindowedList
                  items={emails}
                  estimateSize={118}
                  maxVisible={48}
                  renderItem={(email) => (
                    <Box
                key={email.id}
                component={RouterLink}
                to={`/emails/${encodeURIComponent(email.id)}`}
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
                sx={{ display: 'block', textDecoration: 'none', color: 'inherit', py: 1.6, px: 1, borderRadius: 2, transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(4px)' }, boxShadow: 'inset 3px 0 0 #2557d6' } }}
              >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: { xs: 0.75, sm: 2 }, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Box sx={{ minWidth: 0, width: '100%' }}>
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
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: { xs: 3, sm: 2 }, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{email.snippet}</Typography>
                    </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: { xs: 'normal', sm: 'nowrap' } }}>{email.date}</Typography>
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
    </>
  );
}
