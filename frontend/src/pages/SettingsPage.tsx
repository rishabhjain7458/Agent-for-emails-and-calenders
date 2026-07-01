import { useEffect, useState, type ReactNode } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, Grid, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import XIcon from '@mui/icons-material/X';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import RedditIcon from '@mui/icons-material/Reddit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import { PageHeader } from '../components/PageHeader';
import { connectImapAccount, createDashboardCard, deleteDashboardCard, disconnectAccount, getConnectedAccounts, getConnectAccountUrl, getDashboardCards, getSettings, updateSettings } from '../api/endpoints';
import type { ConnectedAccount, DashboardCard } from '../types';
import { normalizeSocialUrl, socialPlatformLabels, type SocialPlatform } from '../utils/socialAccounts';
import { useSpace } from '../contexts/SpaceContext';

type CardFormType = 'social' | 'news' | 'custom_link' | 'portal' | 'media';
type ZohoSmtpPreset = 'india' | 'global' | 'europe' | 'custom';

const socialPlatforms = Object.entries(socialPlatformLabels) as [SocialPlatform, string][];

const timezoneOptions = [
  { label: 'India (IST)', value: 'Asia/Kolkata' },
  { label: 'United States - Eastern', value: 'America/New_York' },
  { label: 'United States - Pacific', value: 'America/Los_Angeles' },
  { label: 'United Kingdom', value: 'Europe/London' },
  { label: 'United Arab Emirates', value: 'Asia/Dubai' },
  { label: 'Singapore', value: 'Asia/Singapore' },
  { label: 'Australia - Sydney', value: 'Australia/Sydney' },
  { label: 'Canada - Toronto', value: 'America/Toronto' },
  { label: 'Germany', value: 'Europe/Berlin' },
  { label: 'Japan', value: 'Asia/Tokyo' }
];

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

function cardTypeName(type: CardFormType) {
  if (type === 'news') return 'News website';
  if (type === 'portal') return 'Portal';
  if (type === 'media') return 'Media';
  if (type === 'custom_link') return 'Custom link';
  return `${socialPlatformLabels.instagram} account`;
}

function cardNamePlaceholder(type: CardFormType) {
  if (type === 'news') return 'BBC News, TechCrunch';
  if (type === 'portal') return 'School portal, CRM, HRMS';
  if (type === 'media') return 'YouTube, Netflix, Spotify';
  return 'Client portal';
}

function cardUrlPlaceholder(type: CardFormType) {
  if (type === 'social') return '@username or https://...';
  if (type === 'portal') return 'https://portal.example.com';
  if (type === 'media') return 'https://youtube.com/@channel';
  return 'https://example.com';
}

function accountProviderLabel(provider: ConnectedAccount['provider']) {
  return provider === 'microsoft' ? 'Outlook' : provider === 'imap' ? 'IMAP Mail' : provider === 'zoho' ? 'Zoho Mail' : 'Gmail';
}

function SettingsSection({ title, subtitle, chip, children }: { title: string; subtitle: string; chip?: ReactNode; children: ReactNode }) {
  return (
    <Card
      className="premium-panel"
      sx={{
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(64, 82, 112, 0.72)' : 'rgba(210, 220, 236, 0.9)',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack spacing={1.75}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '1.02rem', fontWeight: 950, lineHeight: 1.15 }}>{title}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.35 }}>{subtitle}</Typography>
            </Box>
            {chip}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function CompactRow({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <Box
      sx={{
        alignItems: { xs: 'stretch', sm: 'center' },
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17,26,44,0.64)' : 'rgba(255,255,255,0.82)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.25,
        justifyContent: 'space-between',
        p: 1.25
      }}
    >
      <Stack direction="row" spacing={1.15} alignItems="center" sx={{ minWidth: 0 }}>
        {icon}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{subtitle}</Typography>
        </Box>
      </Stack>
      {action}
    </Box>
  );
}

export function SettingsPage() {
  const { refreshSpaces } = useSpace();
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
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
      setTimezone(settings.timezone && settings.timezone !== 'UTC' ? settings.timezone : 'Asia/Kolkata');
      setIgnorePromotions(settings.email_preferences?.ignorePromotions ?? true);
    });
    getConnectedAccounts().then(setAccounts);
    getDashboardCards().then((result) => setDashboardCards(result.cards));
    const connected = new URLSearchParams(window.location.search).get('connected');
    if (connected) {
      const label = connected === 'microsoft' ? 'Outlook' : connected === 'zoho' ? 'Zoho Mail' : socialPlatformLabels[connected as SocialPlatform] ?? 'Gmail';
      setNotice(`${label} account connected.`);
      window.history.replaceState({}, '', '/settings');
    }
    const socialError = new URLSearchParams(window.location.search).get('social_error');
    if (socialError) {
      setNotice(`Social connect issue: ${socialError}`);
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
    const url = await getConnectAccountUrl(provider);
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
      label: cardLabel.trim() || (cardType === 'social' ? `${socialPlatformLabels[socialPlatform]} account` : cardTypeName(cardType)),
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
    if (card.cardType === 'portal') return <BusinessCenterIcon />;
    if (card.cardType === 'media') return <PermMediaIcon />;
    if (card.cardType === 'social') return socialCardIcon(card.platform);
    return <LinkIcon />;
  }

  function cardColor(card: DashboardCard) {
    if (card.cardType === 'news') return { bg: '#fefce8', fg: '#a16207' };
    if (card.cardType === 'portal') return { bg: 'rgba(14, 116, 144, 0.14)', fg: '#0e7490' };
    if (card.cardType === 'media') return { bg: 'rgba(225, 29, 72, 0.14)', fg: '#e11d48' };
    if (card.cardType === 'social') return socialCardStyle(card.platform);
    return { bg: 'rgba(37, 87, 214, 0.14)', fg: '#2557d6' };
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage accounts, assistant defaults, and dashboard shortcuts." compact />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={4}>
          <SettingsSection
            title="Assistant"
            subtitle="Core AI and workspace defaults."
            chip={<Chip size="small" icon={<SettingsIcon />} label="Tenant scoped" variant="outlined" />}
          >
            <Stack spacing={1.25}>
              <TextField size="small" label="Gemini API Key" type="password" value={geminiApiKey} onChange={(event) => setGeminiApiKey(event.target.value)} />
              <TextField size="small" select label="Workspace timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} helperText="Used by Assistant, Calendar creation, and relative dates.">
                {timezoneOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 1.25, py: 0.5 }}>
                <FormControlLabel control={<Switch checked={ignorePromotions} onChange={(event) => setIgnorePromotions(event.target.checked)} size="small" />} label="Ignore promotions in AI summaries" />
              </Box>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={save}>Save Settings</Button>
            </Stack>
          </SettingsSection>
        </Grid>

        <Grid item xs={12} lg={8}>
          <SettingsSection
            title="Connected Inboxes"
            subtitle="Connect Gmail, Outlook, Zoho OAuth, or Zoho IMAP."
            chip={<Chip size="small" label={`${accounts.length} connected`} variant="outlined" />}
          >
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('google')}>Gmail</Button>
                <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('microsoft')}>Outlook</Button>
                <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => connect('zoho')}>Zoho OAuth</Button>
              </Stack>

              <Accordion disableGutters elevation={0} sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&::before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>Zoho via IMAP</Typography>
                    <Typography variant="caption" color="text.secondary">Advanced fallback using a Zoho app password.</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Grid container spacing={1.25}>
                    <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Zoho email" value={imapEmail} onChange={(event) => setImapEmail(event.target.value)} /></Grid>
                    <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="App password" type="password" value={imapPassword} onChange={(event) => setImapPassword(event.target.value)} /></Grid>
                    <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Display name" value={imapName} onChange={(event) => setImapName(event.target.value)} placeholder="Optional" /></Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" select label="Zoho server region" value={smtpPreset} onChange={(event) => applySmtpPreset(event.target.value as ZohoSmtpPreset)}>
                        <MenuItem value="india">India (.in)</MenuItem>
                        <MenuItem value="global">Global (.com)</MenuItem>
                        <MenuItem value="europe">Europe (.eu)</MenuItem>
                        <MenuItem value="custom">Custom hosts</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={5}><TextField fullWidth size="small" label="IMAP host" value={imapHost} onChange={(event) => { setSmtpPreset('custom'); setImapHost(event.target.value); }} /></Grid>
                    <Grid item xs={12} sm={5}><TextField fullWidth size="small" label="SMTP host" value={smtpHost} onChange={(event) => { setSmtpPreset('custom'); setSmtpHost(event.target.value); }} /></Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField fullWidth size="small" select label="SMTP port" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)}>
                        <MenuItem value="465">465 SSL</MenuItem>
                        <MenuItem value="587">587 TLS</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12}><Button variant="contained" startIcon={<LinkIcon />} onClick={connectZohoImap}>Connect Zoho IMAP</Button></Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 1 }}>Accounts</Typography>
                <Stack spacing={1}>
                  {accounts.map((account) => (
                    <CompactRow
                      key={account.id}
                      icon={<Box sx={{ bgcolor: 'primary.main', borderRadius: 1.5, color: '#fff', display: 'grid', height: 36, placeItems: 'center', width: 36 }}><LinkIcon fontSize="small" /></Box>}
                      title={account.email}
                      subtitle={`${accountProviderLabel(account.provider)}${account.name ? ` · ${account.name}` : ''}`}
                      action={<Button color="error" variant="text" startIcon={<DeleteIcon />} onClick={() => removeAccount(account.id)} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>Disconnect</Button>}
                    />
                  ))}
                  {accounts.length === 0 && <Alert severity="info">No extra inboxes connected yet. Connect Gmail, Outlook, Zoho OAuth, or Zoho IMAP above.</Alert>}
                </Stack>
              </Box>
            </Stack>
          </SettingsSection>
        </Grid>

        <Grid item xs={12}>
          <SettingsSection
            title="Dashboard Cards"
            subtitle="Saved shortcuts are grouped automatically on the dashboard."
            chip={<Chip size="small" icon={<LinkIcon />} label={`${dashboardCards.length} saved`} variant="outlined" />}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} lg={4}>
                <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Typography sx={{ fontWeight: 950 }}>Add shortcut</Typography>
                    <TextField fullWidth size="small" select label="Card type" value={cardType} onChange={(event) => setCardType(event.target.value as CardFormType)}>
                      <MenuItem value="social">Social</MenuItem>
                      <MenuItem value="portal">Portal</MenuItem>
                      <MenuItem value="media">Media</MenuItem>
                      <MenuItem value="news">News</MenuItem>
                      <MenuItem value="custom_link">Custom link</MenuItem>
                    </TextField>
                    {cardType === 'social' ? (
                      <TextField fullWidth size="small" select label="Platform" value={socialPlatform} onChange={(event) => setSocialPlatform(event.target.value as SocialPlatform)}>
                        {socialPlatforms.map(([platform, label]) => (
                          <MenuItem key={platform} value={platform}>{label}</MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField fullWidth size="small" label="Card name" value={cardLabel} onChange={(event) => setCardLabel(event.target.value)} placeholder={cardNamePlaceholder(cardType)} />
                    )}
                    <TextField fullWidth size="small" label={cardType === 'social' ? 'Username or profile URL' : 'Website URL'} value={cardUrl} onChange={(event) => setCardUrl(event.target.value)} placeholder={cardUrlPlaceholder(cardType)} />
                    {cardType === 'social' && <TextField fullWidth size="small" label="Card name" value={cardLabel} onChange={(event) => setCardLabel(event.target.value)} placeholder="Brand page, personal, client" />}
                    <Button fullWidth variant="contained" startIcon={<LinkIcon />} onClick={addDashboardCard}>Add card</Button>
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12} lg={8}>
                <Stack spacing={1}>
                  {dashboardCards.map((card) => {
                    const colors = cardColor(card);
                    return (
                      <CompactRow
                        key={card.id}
                        icon={<Box sx={{ bgcolor: colors.bg, border: '1px solid', borderColor: `${colors.fg}24`, borderRadius: 1.5, color: colors.fg, display: 'grid', flex: '0 0 auto', height: 38, placeItems: 'center', width: 38 }}>{cardIcon(card)}</Box>}
                        title={card.label}
                        subtitle={`${cardTypeName(card.cardType)} · ${card.url}`}
                        action={(
                          <Stack direction="row" spacing={0.75} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>
                            <Button variant="outlined" href={card.url} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>Open</Button>
                            <Button color="error" variant="text" startIcon={<DeleteIcon />} onClick={() => removeDashboardCard(card.id)}>Remove</Button>
                          </Stack>
                        )}
                      />
                    );
                  })}
                  {dashboardCards.length === 0 && <Alert severity="info">No dashboard cards added yet.</Alert>}
                </Stack>
              </Grid>
            </Grid>
          </SettingsSection>
        </Grid>
      </Grid>
    </>
  );
}
