import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, FormControlLabel, Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import { PageHeader } from '../components/PageHeader';
import { disconnectAccount, getConnectedAccounts, getConnectAccountUrl, getSettings, updateSettings } from '../api/endpoints';
import type { ConnectedAccount } from '../types';

export function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [ignorePromotions, setIgnorePromotions] = useState(true);
  const [notice, setNotice] = useState('');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);

  useEffect(() => {
    getSettings().then((settings) => {
      setGeminiApiKey(settings.gemini_api_key ?? '');
      setTimezone(settings.timezone ?? 'UTC');
      setIgnorePromotions(settings.email_preferences?.ignorePromotions ?? true);
    });
    getConnectedAccounts().then(setAccounts);
    const connected = new URLSearchParams(window.location.search).get('connected');
    if (connected) {
      setNotice(`${connected === 'microsoft' ? 'Outlook' : 'Gmail'} account connected.`);
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  async function save() {
    await updateSettings({
      geminiApiKey,
      timezone,
      emailPreferences: {
        priorityCategories: ['security', 'financial', 'work', 'meetings'],
        ignorePromotions
      }
    });
    setNotice('Settings saved.');
  }

  async function connect(provider: 'google' | 'microsoft') {
    window.location.href = await getConnectAccountUrl(provider);
  }

  async function removeAccount(id: string) {
    await disconnectAccount(id);
    setAccounts(await getConnectedAccounts());
    setNotice('Connected account removed.');
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure tenant-aware assistant preferences." />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">AI & Workspace</Typography>
                    <Typography color="text.secondary" variant="body2">Personalize assistant behavior and tenant defaults.</Typography>
                  </Box>
                  <Chip icon={<SettingsIcon />} label="Tenant scoped" variant="outlined" />
                </Stack>
                <TextField label="Gemini API Key" type="password" value={geminiApiKey} onChange={(event) => setGeminiApiKey(event.target.value)} />
                <TextField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                <FormControlLabel control={<Switch checked={ignorePromotions} onChange={(event) => setIgnorePromotions(event.target.checked)} />} label="Ignore promotions in AI email summaries" />
                <Button variant="contained" startIcon={<SaveIcon />} onClick={save}>Save Settings</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Connected Inboxes</Typography>
                  <Typography color="text.secondary" variant="body2">Add extra Gmail or Outlook inboxes for this signed-in user.</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('google')}>Connect Gmail</Button>
                  <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('microsoft')}>Connect Outlook</Button>
                </Stack>
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {accounts.map((account) => (
                    <Box key={account.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 1.25 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{account.email}</Typography>
                          <Chip size="small" label={account.provider === 'microsoft' ? 'Outlook' : 'Gmail'} variant="outlined" />
                        </Stack>
                        {account.name && <Typography variant="body2" color="text.secondary">{account.name}</Typography>}
                      </Box>
                      <Button color="error" variant="text" startIcon={<DeleteIcon />} onClick={() => removeAccount(account.id)}>Remove</Button>
                    </Box>
                  ))}
                  {accounts.length === 0 && <Alert severity="info">No extra inboxes connected yet.</Alert>}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
