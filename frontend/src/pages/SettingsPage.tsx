import { useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, FormControlLabel, Grid, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PageHeader } from '../components/PageHeader';
import { disconnectAccount, getConnectedAccounts, getConnectAccountUrl, getSettings, updateSettings } from '../api/endpoints';
import type { ConnectedAccount } from '../types';
import { loadSocialAccounts, normalizeSocialUrl, saveSocialAccounts, type SocialAccount, type SocialPlatform } from '../utils/socialAccounts';

export function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [ignorePromotions, setIgnorePromotions] = useState(true);
  const [notice, setNotice] = useState('');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('instagram');
  const [socialLabel, setSocialLabel] = useState('');
  const [socialUrl, setSocialUrl] = useState('');

  useEffect(() => {
    getSettings().then((settings) => {
      setGeminiApiKey(settings.gemini_api_key ?? '');
      setTimezone(settings.timezone ?? 'UTC');
      setIgnorePromotions(settings.email_preferences?.ignorePromotions ?? true);
    });
    getConnectedAccounts().then(setAccounts);
    setSocialAccounts(loadSocialAccounts());
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
    const isNative = Capacitor.isNativePlatform();
    const url = await getConnectAccountUrl(provider, isNative);
    if (isNative) {
      await Browser.open({ url });
      return;
    }
    window.location.href = url;
  }

  async function removeAccount(id: string) {
    await disconnectAccount(id);
    setAccounts(await getConnectedAccounts());
    setNotice('Connected account removed.');
  }

  function addSocialAccount() {
    const url = normalizeSocialUrl(socialPlatform, socialUrl);
    if (!url) {
      setNotice('Add a username or profile link first.');
      return;
    }
    const nextAccount: SocialAccount = {
      id: crypto.randomUUID(),
      platform: socialPlatform,
      label: socialLabel.trim() || (socialPlatform === 'instagram' ? 'Instagram account' : 'Facebook account'),
      url
    };
    const next = [nextAccount, ...socialAccounts];
    setSocialAccounts(next);
    saveSocialAccounts(next);
    setSocialLabel('');
    setSocialUrl('');
    setNotice('Social account card added.');
  }

  function removeSocialAccount(id: string) {
    const next = socialAccounts.filter((account) => account.id !== id);
    setSocialAccounts(next);
    saveSocialAccounts(next);
    setNotice('Social account card removed.');
  }

  function socialIcon(platform: SocialPlatform) {
    return platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />;
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure tenant-aware assistant preferences." />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card className="premium-panel">
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
          <Card className="premium-panel">
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
        <Grid item xs={12}>
          <Card className="premium-panel">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">Social Media Cards</Typography>
                    <Typography color="text.secondary" variant="body2">Add Facebook and Instagram profiles. Cards open the account in a new tab.</Typography>
                  </Box>
                  <Chip icon={<LinkIcon />} label={`${socialAccounts.length} saved`} variant="outlined" />
                </Stack>
                <Grid container spacing={1.25} alignItems="flex-start">
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth select label="Platform" value={socialPlatform} onChange={(event) => setSocialPlatform(event.target.value as SocialPlatform)}>
                      <MenuItem value="instagram">Instagram</MenuItem>
                      <MenuItem value="facebook">Facebook</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth label="Card name" value={socialLabel} onChange={(event) => setSocialLabel(event.target.value)} placeholder="Brand page, personal, client" />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth label="Username or profile URL" value={socialUrl} onChange={(event) => setSocialUrl(event.target.value)} placeholder="@username or https://..." />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button fullWidth variant="contained" startIcon={<LinkIcon />} onClick={addSocialAccount} sx={{ minHeight: 54 }}>Add</Button>
                  </Grid>
                </Grid>
                <Grid container spacing={1.5}>
                  {socialAccounts.map((account) => (
                    <Grid item xs={12} md={6} lg={4} key={account.id}>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fff', p: 1.5 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box sx={{ bgcolor: account.platform === 'instagram' ? '#fdf2f8' : '#eff6ff', borderRadius: 1.5, color: account.platform === 'instagram' ? '#c026d3' : '#2563eb', display: 'grid', flex: '0 0 auto', height: 42, placeItems: 'center', width: 42 }}>
                            {socialIcon(account.platform)}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 850 }} noWrap>{account.label}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{account.url}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                          <Button fullWidth variant="outlined" href={account.url} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>Open</Button>
                          <Button color="error" variant="text" startIcon={<DeleteIcon />} onClick={() => removeSocialAccount(account.id)}>Remove</Button>
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                  {socialAccounts.length === 0 && (
                    <Grid item xs={12}>
                      <Alert severity="info">No social media cards added yet.</Alert>
                    </Grid>
                  )}
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
