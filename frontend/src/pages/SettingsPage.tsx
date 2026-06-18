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
import NewspaperIcon from '@mui/icons-material/Newspaper';
import { PageHeader } from '../components/PageHeader';
import { createDashboardCard, deleteDashboardCard, disconnectAccount, getConnectedAccounts, getConnectAccountUrl, getDashboardCards, getSettings, updateSettings } from '../api/endpoints';
import type { ConnectedAccount, DashboardCard } from '../types';
import { normalizeSocialUrl, type SocialPlatform } from '../utils/socialAccounts';

type CardFormType = 'social' | 'news' | 'custom_link';

export function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [ignorePromotions, setIgnorePromotions] = useState(true);
  const [notice, setNotice] = useState('');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [dashboardCards, setDashboardCards] = useState<DashboardCard[]>([]);
  const [cardType, setCardType] = useState<CardFormType>('social');
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('instagram');
  const [cardLabel, setCardLabel] = useState('');
  const [cardUrl, setCardUrl] = useState('');

  useEffect(() => {
    getSettings().then((settings) => {
      setGeminiApiKey(settings.gemini_api_key ?? '');
      setTimezone(settings.timezone ?? 'UTC');
      setIgnorePromotions(settings.email_preferences?.ignorePromotions ?? true);
    });
    getConnectedAccounts().then(setAccounts);
    getDashboardCards().then((result) => setDashboardCards(result.cards));
    const connected = new URLSearchParams(window.location.search).get('connected');
    if (connected) {
      setNotice(`${connected === 'microsoft' ? 'Outlook' : connected === 'zoho' ? 'Zoho Mail' : 'Gmail'} account connected.`);
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

  async function connect(provider: 'google' | 'microsoft' | 'zoho') {
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

  async function addDashboardCard() {
    const url = cardType === 'social' ? normalizeSocialUrl(socialPlatform, cardUrl) : cardUrl.trim();
    if (!url) {
      setNotice('Add a URL or username first.');
      return;
    }
    await createDashboardCard({
      cardType,
      platform: cardType === 'social' ? socialPlatform : cardType,
      label: cardLabel.trim() || (cardType === 'news' ? 'News website' : cardType === 'custom_link' ? 'Custom link' : socialPlatform === 'instagram' ? 'Instagram account' : 'Facebook account'),
      url
    });
    setDashboardCards((await getDashboardCards()).cards);
    setCardLabel('');
    setCardUrl('');
    setNotice('Dashboard card added.');
  }

  async function removeDashboardCard(id: string) {
    await deleteDashboardCard(id);
    setDashboardCards((await getDashboardCards()).cards);
    setNotice('Dashboard card removed.');
  }

  function cardIcon(card: DashboardCard) {
    if (card.cardType === 'news') return <NewspaperIcon />;
    if (card.platform === 'instagram') return <InstagramIcon />;
    if (card.platform === 'facebook') return <FacebookIcon />;
    return <LinkIcon />;
  }

  function cardColor(card: DashboardCard) {
    if (card.cardType === 'news') return { bg: '#fefce8', fg: '#a16207' };
    if (card.platform === 'instagram') return { bg: '#fdf2f8', fg: '#c026d3' };
    if (card.platform === 'facebook') return { bg: '#eff6ff', fg: '#2563eb' };
    return { bg: '#f8faff', fg: '#2557d6' };
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
                  <Typography color="text.secondary" variant="body2">Add extra Gmail, Outlook, or Zoho Mail inboxes for this signed-in user.</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('google')}>Connect Gmail</Button>
                  <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('microsoft')}>Connect Outlook</Button>
                  <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('zoho')}>Connect Zoho Mail</Button>
                </Stack>
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {accounts.map((account) => (
                    <Box key={account.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 1.25 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{account.email}</Typography>
                          <Chip size="small" label={account.provider === 'microsoft' ? 'Outlook' : account.provider === 'zoho' ? 'Zoho Mail' : 'Gmail'} variant="outlined" />
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
                    <Typography variant="h6">Dashboard Link Cards</Typography>
                    <Typography color="text.secondary" variant="body2">Add social, news, or custom links. Reorder them directly on the Dashboard.</Typography>
                  </Box>
                  <Chip icon={<LinkIcon />} label={`${dashboardCards.length} saved`} variant="outlined" />
                </Stack>
                <Grid container spacing={1.25} alignItems="flex-start">
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth select label="Card type" value={cardType} onChange={(event) => setCardType(event.target.value as CardFormType)}>
                      <MenuItem value="social">Social</MenuItem>
                      <MenuItem value="news">News</MenuItem>
                      <MenuItem value="custom_link">Custom link</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    {cardType === 'social' ? (
                      <TextField fullWidth select label="Platform" value={socialPlatform} onChange={(event) => setSocialPlatform(event.target.value as SocialPlatform)}>
                        <MenuItem value="instagram">Instagram</MenuItem>
                        <MenuItem value="facebook">Facebook</MenuItem>
                      </TextField>
                    ) : (
                      <TextField fullWidth label="Card name" value={cardLabel} onChange={(event) => setCardLabel(event.target.value)} placeholder={cardType === 'news' ? 'BBC News, TechCrunch' : 'Client portal'} />
                    )}
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth label={cardType === 'social' ? 'Username or profile URL' : 'Website URL'} value={cardUrl} onChange={(event) => setCardUrl(event.target.value)} placeholder={cardType === 'social' ? '@username or https://...' : 'https://example.com'} />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button fullWidth variant="contained" startIcon={<LinkIcon />} onClick={addDashboardCard} sx={{ minHeight: 54 }}>Add</Button>
                  </Grid>
                  {cardType === 'social' && (
                    <Grid item xs={12} sm={3}>
                      <TextField fullWidth label="Card name" value={cardLabel} onChange={(event) => setCardLabel(event.target.value)} placeholder="Brand page, personal, client" />
                    </Grid>
                  )}
                </Grid>
                <Grid container spacing={1.5}>
                  {dashboardCards.map((card) => {
                    const colors = cardColor(card);
                    return (
                    <Grid item xs={12} md={6} lg={4} key={card.id}>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fff', p: 1.5 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box sx={{ bgcolor: colors.bg, borderRadius: 1.5, color: colors.fg, display: 'grid', flex: '0 0 auto', height: 42, placeItems: 'center', width: 42 }}>
                            {cardIcon(card)}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 850 }} noWrap>{card.label}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{card.url}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
                          <Button fullWidth variant="outlined" href={card.url} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>Open</Button>
                          <Button color="error" variant="text" startIcon={<DeleteIcon />} onClick={() => removeDashboardCard(card.id)}>Remove</Button>
                        </Stack>
                      </Box>
                    </Grid>
                  );})}
                  {dashboardCards.length === 0 && (
                    <Grid item xs={12}>
                      <Alert severity="info">No dashboard link cards added yet.</Alert>
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
