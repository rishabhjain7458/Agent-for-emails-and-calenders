import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { PageHeader } from '../components/PageHeader';
import { getEmails, getEmailSummary } from '../api/endpoints';
import type { EmailMessage } from '../types';

const emailFilters = [
  { label: 'Inbox', query: 'in:inbox' },
  { label: 'Unread', query: 'in:inbox is:unread' },
  { label: 'Important', query: 'in:inbox is:important' },
  { label: 'Attachments', query: 'in:inbox has:attachment' },
  { label: 'This week', query: 'in:inbox newer_than:7d' },
  { label: 'Sent', query: 'in:sent' }
];

export function EmailsPage() {
  const [query, setQuery] = useState('in:inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(q = query) {
    setLoading(true);
    try {
      setEmails(await getEmails(q));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('in:inbox');
  }, []);

  function applyFilter(nextQuery: string) {
    setQuery(nextQuery);
    load(nextQuery);
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
          <Card>
            <CardContent>
              <Typography variant="h6">Advanced Search</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Compose a Gmail query or add common operators.</Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Quick filters</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {emailFilters.map((filter) => (
                      <Chip
                        key={filter.query}
                        label={filter.label}
                        color={query === filter.query ? 'primary' : 'default'}
                        variant={query === filter.query ? 'filled' : 'outlined'}
                        onClick={() => applyFilter(filter.query)}
                      />
                    ))}
                  </Stack>
                </Box>
                <TextField label="Gmail query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="from:john@example.com is:unread" />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 800 }}>Query operators</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {['is:unread', 'has:attachment', 'newer_than:7d', 'from:'].map((operator) => (
                    <Chip key={operator} label={operator} variant="outlined" onClick={() => setQuery((current) => `${current} ${operator}`.trim())} />
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
          <Card>
            {loading && <LinearProgress />}
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6">Inbox Results</Typography>
                  <Typography color="text.secondary" variant="body2">{emails.length} messages returned</Typography>
                </Box>
                <MailOutlineIcon color="primary" />
              </Stack>
              <Stack divider={<Divider flexItem />} spacing={0}>
            {emails.map((email) => (
              <Box key={email.id} component={RouterLink} to={`/emails/${email.id}`} sx={{ display: 'block', textDecoration: 'none', color: 'inherit', py: 1.6, px: 1, borderRadius: 2, transition: 'background 160ms ease', '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {email.unread && <Chip size="small" label="Unread" color="primary" />}
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>{email.subject}</Typography>
                      </Stack>
                      <Typography color="text.secondary" variant="body2" noWrap>{email.sender}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{email.snippet}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{email.date}</Typography>
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
