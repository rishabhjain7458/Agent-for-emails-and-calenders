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
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import XIcon from '@mui/icons-material/X';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import RedditIcon from '@mui/icons-material/Reddit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import { PageHeader } from '../components/PageHeader';
import { connectImapAccount, createDashboardCard, deleteDashboardCard, disconnectAccount, getConnectedAccounts, getConnectAccountUrl, getDashboardCards, getSettings, updateSettings } from '../api/endpoints';
import type { ConnectedAccount, DashboardCard } from '../types';
import { normalizeSocialUrl, socialPlatformLabels, type SocialPlatform } from '../utils/socialAccounts';
import { useSpace } from '../contexts/SpaceContext';

type CardFormType = 'social' | 'news' | 'custom_link';
type ZohoSmtpPreset = 'india' | 'global' | 'europe' | 'custom';

const socialPlatforms = Object.entries(socialPlatformLabels) as [SocialPlatform, string][];

function socialCardStyle(platform?: string | null) {
  if (platform === 'instagram') return { bg: 'rgba(192, 38, 211, 0.14)', fg: '#c026d3' };
  if (platform === 'facebook') return { bg: 'rgba(37, 99, 235, 0.14)', fg: '#2563eb' };
  if (platform === 'linkedin') return { bg: 'rgba(10, 102, 194, 0.14)', fg: '#0a66c2' };
  if (platform === 'x') return { bg: 'rgba(148, 163, 184, 0.16)', fg: '#8b98aa' };
  if (platform === 'threads') return { bg: 'rgba(139, 92, 246, 0.15)', fg: '#8b5cf6' };
  if (platform === 'reddit') return { bg: 'rgba(255, 69, 0, 0.14)', fg: '#ff4500' };
  return { bg: 'rgba(37, 87, 214, 0.14)', fg: '#2557d6' };
}

function socialCardIcon(platform?: string | null) {
  if (platform === 'instagram') return <InstagramIcon />;
  if (platform === 'facebook') return <FacebookIcon />;
  if (platform === 'linkedin') return <LinkedInIcon />;
  if (platform === 'x') return <XIcon />;
  if (platform === 'threads') return <AlternateEmailIcon />;
  if (platform === 'reddit') return <RedditIcon />;
  return <LinkIcon />;
}

function accountProviderLabel(provider: ConnectedAccount['provider']) {
  return provider === 'microsoft' ? 'Outlook' : provider === 'imap' ? 'IMAP Mail' : provider === 'zoho' ? 'Zoho Mail' : 'Gmail';
}

export function SettingsPage() {
  const { refreshSpaces } = useSpace();
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
  const [imapEmail, setImapEmail] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [imapName, setImapName] = useState('');
  const [imapHost, setImapHost] = useState('imappro.zoho.in');
  const [smtpHost, setSmtpHost] = useState('smtp.zoho.in');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpPreset, setSmtpPreset] = useState<ZohoSmtpPreset>('india');

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
    await refreshSpaces();
    setNotice('Connected account removed.');
  }

  async function connectZohoImap() {
    if (!imapEmail.trim() || !imapPassword.trim()) {
      setNotice('Add your Zoho email and app password first.');
      return;
    }
    await connectImapAccount({
      email: imapEmail,
      password: imapPassword,
      name: imapName,
      imapHost,
      imapPort: 993,
      imapSecure: true,
      smtpHost,
      smtpPort: Number(smtpPort),
      smtpSecure: smtpPort === '465'
    });
    setAccounts(await getConnectedAccounts());
    await refreshSpaces();
    setImapEmail('');
    setImapPassword('');
    setImapName('');
    setNotice('Zoho mailbox connected through IMAP.');
  }

  function applySmtpPreset(nextPreset: ZohoSmtpPreset) {
    setSmtpPreset(nextPreset);
    if (nextPreset === 'india') {
      setImapHost('imappro.zoho.in');
      setSmtpHost('smtp.zoho.in');
      return;
    }
    if (nextPreset === 'global') {
      setImapHost('imappro.zoho.com');
      setSmtpHost('smtp.zoho.com');
      return;
    }
    if (nextPreset === 'europe') {
      setImapHost('imappro.zoho.eu');
      setSmtpHost('smtp.zoho.eu');
    }
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
      label: cardLabel.trim() || (cardType === 'news' ? 'News website' : cardType === 'custom_link' ? 'Custom link' : `${socialPlatformLabels[socialPlatform]} account`),
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
    if (card.cardType === 'social') return socialCardIcon(card.platform);
    return <LinkIcon />;
  }

  function cardColor(card: DashboardCard) {
    if (card.cardType === 'news') return { bg: '#fefce8', fg: '#a16207' };
    if (card.cardType === 'social') return socialCardStyle(card.platform);
    return { bg: 'rgba(37, 87, 214, 0.14)', fg: '#2557d6' };
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
                  <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('zoho')}>Connect Zoho OAuth</Button>
                </Stack>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', p: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Zoho via IMAP</Typography>
                      <Typography variant="caption" color="text.secondary">Use a Zoho app password. OAuth remains available above.</Typography>
                    </Box>
                    <TextField size="small" label="Zoho email" value={imapEmail} onChange={(event) => setImapEmail(event.target.value)} />
                    <TextField size="small" label="App password" type="password" value={imapPassword} onChange={(event) => setImapPassword(event.target.value)} />
                    <TextField size="small" label="Display name" value={imapName} onChange={(event) => setImapName(event.target.value)} placeholder="Optional" />
                    <TextField size="small" select label="Zoho server region" value={smtpPreset} onChange={(event) => applySmtpPreset(event.target.value as ZohoSmtpPreset)}>
                      <MenuItem value="india">India (.in)</MenuItem>
                      <MenuItem value="global">Global (.com)</MenuItem>
                      <MenuItem value="europe">Europe (.eu)</MenuItem>
                      <MenuItem value="custom">Custom hosts</MenuItem>
                    </TextField>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField size="small" label="IMAP host" value={imapHost} onChange={(event) => { setSmtpPreset('custom'); setImapHost(event.target.value); }} />
                      <TextField size="small" label="SMTP host" value={smtpHost} onChange={(event) => { setSmtpPreset('custom'); setSmtpHost(event.target.value); }} />
                    </Stack>
                    <TextField size="small" select label="SMTP port" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)}>
                      <MenuItem value="465">465 SSL</MenuItem>
                      <MenuItem value="587">587 TLS</MenuItem>
                    </TextField>
                    <Button variant="contained" startIcon={<LinkIcon />} onClick={connectZohoImap}>Connect Zoho IMAP</Button>
                  </Stack>
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Manage connected accounts</Typography>
                      <Typography variant="caption" color="text.secondary">Your primary login account is managed by logout. Extra inboxes can be disconnected here.</Typography>
                    </Box>
                    <Chip size="small" label={`${accounts.length} connected`} variant="outlined" />
                  </Stack>
                </Box>
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {accounts.map((account) => (
                    <Box key={account.id} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.25, mb: 1, p: 1.25 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{account.email}</Typography>
                          <Chip size="small" label={accountProviderLabel(account.provider)} variant="outlined" />
                        </Stack>
                        {account.name && <Typography variant="body2" color="text.secondary">{account.name}</Typography>}
                      </Box>
                      <Button color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={() => removeAccount(account.id)} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>Disconnect account</Button>
                    </Box>
                  ))}
                  {accounts.length === 0 && <Alert severity="info">No extra inboxes connected yet. Connect Gmail, Outlook, Zoho OAuth, or Zoho IMAP above.</Alert>}
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
                        {socialPlatforms.map(([platform, label]) => (
                          <MenuItem key={platform} value={platform}>{label}</MenuItem>
                        ))}
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
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 1.5 }}>
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
