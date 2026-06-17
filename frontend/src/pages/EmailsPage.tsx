import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { PageHeader } from '../components/PageHeader';
import { getConnectedAccounts, getEmails, getEmailSummary } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import type { ConnectedAccount, EmailMessage } from '../types';

const emailFilters = [
  { label: 'Inbox', query: 'in:inbox', helper: 'All inbox mail' },
  { label: 'Unread', query: 'in:inbox is:unread', helper: 'Needs attention' },
  { label: 'Important', query: 'in:inbox is:important', helper: 'Marked important' },
  { label: 'Attachments', query: 'in:inbox has:attachment', helper: 'Files included' },
  { label: 'This week', query: 'in:inbox newer_than:7d', helper: 'Recent inbox' },
  { label: 'Sent', query: 'in:sent', helper: 'Sent mail' }
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

export function EmailsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') || 'in:inbox';
  const [query, setQuery] = useState(initialQuery);
  const [accountId, setAccountId] = useState('all');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(q = query) {
    setLoading(true);
    try {
      setEmails(await getEmails(q, accountId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getConnectedAccounts().then(setAccounts);
    load(initialQuery);
  }, []);

  useEffect(() => {
    const nextQuery = searchParams.get('query');
    if (nextQuery && nextQuery !== query) {
      setQuery(nextQuery);
      load(nextQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    load(query);
  }, [accountId]);

  const accountOptions = [
    { id: 'primary', email: user?.email ?? 'Primary account', label: `${user?.email ?? 'Primary account'} (primary)` },
    ...accounts.map((account) => ({ id: account.id, email: account.email, label: account.email }))
  ];

  function applyFilter(nextQuery: string) {
    setQuery(nextQuery);
    load(nextQuery);
  }

  function appendOperator(operator: string) {
    setQuery((current) => `${current} ${operator}`.replace(/\s+/g, ' ').trim());
  }

  return (
    <>
      <PageHeader
        title="Emails"
        subtitle="Search Gmail, summarize important mail, and draft approved replies."
        action={<Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={async () => setSummary(await getEmailSummary())}>AI Summary</Button>}
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Card className="premium-panel">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Gmail Search</Typography>
                  <Typography color="text.secondary" variant="body2">Build precise inbox queries with Gmail operators.</Typography>
                </Box>
                <Chip icon={<FilterAltIcon />} label="Filters" color="primary" variant="outlined" />
              </Stack>
              <Stack spacing={2.2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Quick filters</Typography>
                  <Grid container spacing={1}>
                    {emailFilters.map((filter) => (
                      <Grid item xs={6} key={filter.query}>
                        <Button
                          fullWidth
                          variant={query === filter.query ? 'contained' : 'outlined'}
                          onClick={() => applyFilter(filter.query)}
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
                <TextField select label="Search account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <MenuItem value="all">All accounts</MenuItem>
                  {accountOptions.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Gmail query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="in:inbox from:name@example.com newer_than:7d" helperText="Examples: from:person@example.com, subject:invoice, filename:pdf, older_than:30d" />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Query operators</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {queryOperators.map((operator) => (
                      <Chip key={operator} label={operator} variant="outlined" onClick={() => appendOperator(operator)} sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
                    ))}
                  </Stack>
                </Box>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={() => load()}>Search</Button>
              </Stack>
            </CardContent>
          </Card>
          {summary && <Alert sx={{ mt: 2 }} severity="info">{summary}</Alert>}
        </Grid>
        <Grid item xs={12} md={8}>
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
            {emails.map((email) => (
              <Box key={email.id} component={RouterLink} to={`/emails/${encodeURIComponent(email.id)}`} sx={{ display: 'block', textDecoration: 'none', color: 'inherit', py: 1.6, px: 1, borderRadius: 2, transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(4px)' }, boxShadow: 'inset 3px 0 0 #2557d6' } }}>
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
            ))}
                {!loading && emails.length === 0 && <Alert severity="info">No emails found.</Alert>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
