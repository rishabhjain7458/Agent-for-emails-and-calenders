import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, FormControlLabel, Grid, IconButton, LinearProgress, Stack, Switch, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MailIcon from '@mui/icons-material/Mail';
import EventIcon from '@mui/icons-material/Event';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import LayersIcon from '@mui/icons-material/Layers';
import InboxIcon from '@mui/icons-material/Inbox';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import XIcon from '@mui/icons-material/X';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import RedditIcon from '@mui/icons-material/Reddit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import InsightsIcon from '@mui/icons-material/Insights';
import { PageHeader } from '../components/PageHeader';
import { completeTask, getDashboardCards, getEmails, getEvents, getTasks, updateDashboardCardOrder } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { CalendarEvent, DashboardCard as LinkDashboardCard, EmailMessage, Task } from '../types';
import { socialPlatformLabels } from '../utils/socialAccounts';

const accountPalette = ['#2557d6', '#0f9f8f', '#b86b00', '#8b5cf6', '#e0476b', '#168053'];

type MixedDashboardCard =
  | { id: string; kind: 'combined' }
  | { id: string; kind: 'space'; account: ReturnType<typeof useSpace>['spaces'][number] & { color: string; emails: number; tasks: number } }
  | { id: string; kind: 'link'; account: LinkDashboardCard };

function eventStart(event: CalendarEvent) {
  const value = event.start?.dateTime ?? event.start?.date;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nextMeeting(events: CalendarEvent[]) {
  return events
    .map((event) => ({ event, starts: eventStart(event) }))
    .filter((item): item is { event: CalendarEvent; starts: Date } => item.starts instanceof Date && item.starts.getTime() >= Date.now())
    .sort((a, b) => a.starts.getTime() - b.starts.getTime())[0]?.event;
}

function overdueTasks(tasks: Task[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.filter((task) => task.status !== 'completed' && task.due_date && new Date(task.due_date).getTime() < today.getTime());
}

function isLikelyImportantSender(email: EmailMessage) {
  return !/no-reply|noreply|newsletter|promotion|marketing|updates|notification|mailer-daemon/i.test(`${email.sender} ${email.subject}`);
}

function formatDueDate(value?: string) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMeetingTime(event?: CalendarEvent) {
  if (!event) return 'No upcoming meeting';
  const starts = eventStart(event);
  if (!starts) return 'Time unavailable';
  return starts.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function itemAccountKey(item: { accountId?: string; accountEmail?: string; account_id?: string; account_email?: string }) {
  return item.accountId ?? item.account_id ?? item.accountEmail ?? item.account_email ?? 'primary';
}

function providerLabel(provider?: 'google' | 'microsoft' | 'zoho' | 'imap') {
  return provider === 'microsoft' ? 'Outlook' : provider === 'imap' ? 'IMAP Mail' : provider === 'zoho' ? 'Zoho Mail' : 'Gmail';
}

function metricLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function mergeCardOrder(ids: string[], order: string[]) {
  const uniqueOrder = order.filter((id, index) => ids.includes(id) && order.indexOf(id) === index);
  return [...uniqueOrder, ...ids.filter((id) => !uniqueOrder.includes(id))];
}

function linkCardMeta(card: LinkDashboardCard) {
  if (card.cardType === 'news') return { accent: '#a16207', accentBg: 'rgba(161, 98, 7, 0.14)', label: 'News', icon: <NewspaperIcon /> };
  if (card.platform === 'instagram') return { accent: '#c026d3', accentBg: 'rgba(192, 38, 211, 0.14)', label: socialPlatformLabels.instagram, icon: <InstagramIcon /> };
  if (card.platform === 'facebook') return { accent: '#2563eb', accentBg: 'rgba(37, 99, 235, 0.14)', label: socialPlatformLabels.facebook, icon: <FacebookIcon /> };
  if (card.platform === 'linkedin') return { accent: '#0a66c2', accentBg: 'rgba(10, 102, 194, 0.14)', label: socialPlatformLabels.linkedin, icon: <LinkedInIcon /> };
  if (card.platform === 'x') return { accent: '#8b98aa', accentBg: 'rgba(148, 163, 184, 0.16)', label: socialPlatformLabels.x, icon: <XIcon /> };
  if (card.platform === 'threads') return { accent: '#8b5cf6', accentBg: 'rgba(139, 92, 246, 0.15)', label: socialPlatformLabels.threads, icon: <AlternateEmailIcon /> };
  if (card.platform === 'reddit') return { accent: '#ff4500', accentBg: 'rgba(255, 69, 0, 0.14)', label: socialPlatformLabels.reddit, icon: <RedditIcon /> };
  return { accent: '#2557d6', accentBg: 'rgba(37, 87, 214, 0.14)', label: 'Custom link', icon: <OpenInNewIcon /> };
}

function socialHandleFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname.includes('reddit.com') && parts[0]?.toLowerCase() === 'user') return parts[1] ?? '';
    return parts[0]?.replace(/^@/, '') ?? '';
  } catch {
    return value.trim().replace(/^@/, '').replace(/^\/+/, '');
  }
}

function socialAvatarUrl(card: LinkDashboardCard) {
  const metadataImage = typeof card.metadata?.imageUrl === 'string' ? card.metadata.imageUrl : '';
  if (metadataImage) return metadataImage;
  if (card.cardType !== 'social' || !card.platform) return '';
  const handle = socialHandleFromUrl(card.url);
  if (!handle) return '';
  const platform = card.platform === 'x' ? 'twitter' : card.platform;
  return `https://unavatar.io/${platform}/${encodeURIComponent(handle)}`;
}

function avatarInitial(card: LinkDashboardCard) {
  return (card.label || socialHandleFromUrl(card.url) || 'A').trim().charAt(0).toUpperCase();
}

function dashboardCardUrl(card: LinkDashboardCard) {
  if (card.cardType === 'social' && card.platform === 'facebook' && card.metadata?.connectedViaOAuth) {
    return 'https://www.facebook.com/';
  }
  return card.url;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function withinDays(date: Date | null, days: number) {
  if (!date) return false;
  const now = Date.now();
  const time = date.getTime();
  return time >= now && time <= now + days * 24 * 60 * 60 * 1000;
}

function ChartBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = percentage(value, total);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.65 }}>
        <Typography variant="body2" sx={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{value}</Typography>
      </Stack>
      <Box sx={{ bgcolor: '#edf2fb', borderRadius: 999, height: 9, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: color, borderRadius: 999, height: '100%', transition: 'width 260ms ease', width: `${pct}%` }} />
      </Box>
    </Box>
  );
}

function DonutMetric({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const pct = percentage(value, total);
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          alignItems: 'center',
          background: `conic-gradient(${color} 0deg ${pct * 3.6}deg, #e8eef8 ${pct * 3.6}deg 360deg)`,
          borderRadius: '50%',
          display: 'flex',
          flex: '0 0 auto',
          height: 86,
          justifyContent: 'center',
          position: 'relative',
          width: 86,
          '&::after': { bgcolor: 'background.paper', borderRadius: '50%', content: '""', height: 58, position: 'absolute', width: 58 }
        }}
      >
        <Typography sx={{ color, fontWeight: 950, position: 'relative', zIndex: 1 }}>{pct}%</Typography>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value} of {total || 0}</Typography>
      </Box>
    </Stack>
  );
}

function SignalTile({ label, value, helper, color, icon }: { label: string; value: string | number; helper: string; color: string; icon: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: `${color}30`,
        borderRadius: 2,
        boxShadow: `0 16px 34px ${color}12`,
        minHeight: 118,
        overflow: 'hidden',
        p: 1.65,
        position: 'relative',
        '&::after': {
          bgcolor: `${color}10`,
          borderRadius: '50%',
          content: '""',
          height: 96,
          position: 'absolute',
          right: -34,
          top: -34,
          width: 96
        }
      }}
    >
      <Stack spacing={1.15} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850, textTransform: 'uppercase' }}>{label}</Typography>
          <Box sx={{ bgcolor: `${color}14`, borderRadius: 1.5, color, display: 'grid', height: 34, placeItems: 'center', width: 34 }}>
            {icon}
          </Box>
        </Stack>
        <Typography variant="h4" sx={{ color, fontWeight: 950, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.35 }}>{helper}</Typography>
      </Stack>
    </Box>
  );
}

function CardMoveControls({ disabledLeft, disabledRight, onLeft, onRight }: { disabledLeft: boolean; disabledRight: boolean; onLeft: () => void; onRight: () => void }) {
  return (
    <Stack direction="row" spacing={0.25} sx={{ flex: '0 0 auto' }}>
      <Tooltip title="Move left">
        <span>
          <IconButton size="small" disabled={disabledLeft} onClick={onLeft} sx={{ height: 28, width: 28 }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Move right">
        <span>
          <IconButton size="small" disabled={disabledRight} onClick={onRight} sx={{ height: 28, width: 28 }}>
            <ArrowForwardIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

export function DashboardPage() {
  const { activeSpaceId, setActiveSpaceId, isCombined, spaces } = useSpace();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailMessage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkCards, setLinkCards] = useState<LinkDashboardCard[]>([]);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [cardOrderLoaded, setCardOrderLoaded] = useState(false);
  const [cardOrderSaving, setCardOrderSaving] = useState(false);
  const [cardOrderError, setCardOrderError] = useState('');
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('o-connect-focus-mode') === 'true');
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);
  const shortcutsRef = useRef<HTMLDivElement | null>(null);

  async function loadDashboard() {
    setLoading(true);
    const results = await Promise.allSettled([
      getEmails('in:inbox is:unread', 'all', 16, { dashboard: true }),
      getEmails('in:inbox newer_than:14d', 'all', 24, { dashboard: true }),
      getEvents('all', { dashboard: true }),
      getTasks('all', { dashboard: true })
    ]);
    const nextErrors: string[] = [];
    const [mailResult, recentMailResult, calendarResult, taskResult] = results;

    if (mailResult.status === 'fulfilled') setEmails(mailResult.value);
    else nextErrors.push('Unread emails could not be loaded.');

    if (recentMailResult.status === 'fulfilled') setRecentEmails(recentMailResult.value);
    else nextErrors.push('Recent email analysis could not be loaded.');

    if (calendarResult.status === 'fulfilled') setEvents(calendarResult.value);
    else nextErrors.push('Upcoming meetings could not be loaded.');

    if (taskResult.status === 'fulfilled') setTasks(taskResult.value);
    else nextErrors.push('Pending tasks could not be loaded.');

    setErrors(nextErrors);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    getDashboardCards().then((result) => {
      setLinkCards(result.cards);
      setCardOrder(result.cardOrder);
      setCardOrderLoaded(true);
    }).catch(() => {
      setCardOrderLoaded(true);
      setCardOrderError('Dashboard card order could not be loaded.');
    });
  }, []);

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status !== 'completed'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'completed'), [tasks]);
  const overdue = useMemo(() => overdueTasks(tasks), [tasks]);

  const accountColors = useMemo(() => {
    const entries = spaces.map((account, index) => [account.id, accountPalette[index % accountPalette.length]] as const);
    const byEmail = spaces.map((account, index) => [account.email, accountPalette[index % accountPalette.length]] as const);
    return new Map([...entries, ...byEmail]);
  }, [spaces]);

  const accountSpaces = useMemo(() => spaces.map((account) => {
    const keyMatches = (item: { accountId?: string; accountEmail?: string; account_id?: string; account_email?: string }) => itemAccountKey(item) === account.id || item.accountEmail === account.email || item.account_email === account.email;
    const accountEvents = events.filter(keyMatches);
    const accountEmails = emails.filter(keyMatches);
    const accountTasks = pendingTasks.filter(keyMatches);

    return {
      ...account,
      color: accountColors.get(account.id) ?? '#2557d6',
      emails: accountEmails.length,
      events: accountEvents.length,
      tasks: accountTasks.length,
      nextEvent: nextMeeting(accountEvents)
    };
  }), [accountColors, emails, events, pendingTasks, spaces]);

  const dashboardCards = useMemo<MixedDashboardCard[]>(() => [
    { id: 'combined', kind: 'combined' },
    ...accountSpaces.map((account) => ({ id: `space:${account.id}`, kind: 'space' as const, account })),
    ...linkCards.map((account) => ({ id: `custom:${account.id}`, kind: 'link' as const, account }))
  ], [accountSpaces, linkCards]);

  useEffect(() => {
    if (!cardOrderLoaded) return;
    const ids = dashboardCards.map((card) => card.id);
    setCardOrder((current) => {
      const next = mergeCardOrder(ids, current);
      if (next.join('|') === current.join('|')) return current;
      updateDashboardCardOrder(next).catch(() => setCardOrderError('Dashboard card order could not be saved.'));
      return next;
    });
  }, [cardOrderLoaded, dashboardCards]);

  const orderedDashboardCards = useMemo(() => {
    const order = mergeCardOrder(dashboardCards.map((card) => card.id), cardOrder);
    return [...dashboardCards].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [cardOrder, dashboardCards]);

  const selectedSpace = isCombined ? null : accountSpaces.find((account) => account.id === activeSpaceId) ?? accountSpaces[0];
  const selectedSpaceColor = selectedSpace?.color ?? '#2557d6';
  const scopedEmails = selectedSpace
    ? emails.filter((email) => itemAccountKey(email) === selectedSpace.id || email.accountEmail === selectedSpace.email)
    : emails;
  const scopedEvents = selectedSpace
    ? events.filter((event) => itemAccountKey(event) === selectedSpace.id || event.accountEmail === selectedSpace.email)
    : events;
  const scopedTasks = selectedSpace
    ? pendingTasks.filter((task) => itemAccountKey(task) === selectedSpace.id || task.account_email === selectedSpace.email)
    : pendingTasks;
  const scopedCompletedTasks = selectedSpace
    ? completedTasks.filter((task) => itemAccountKey(task) === selectedSpace.id || task.account_email === selectedSpace.email)
    : completedTasks;
  const scopedAllTasks = [...scopedTasks, ...scopedCompletedTasks];
  const scopedOverdueTasks = overdue.filter((task) => !selectedSpace || itemAccountKey(task) === selectedSpace.id || task.account_email === selectedSpace.email);
  const priorityEmails = scopedEmails.filter(isLikelyImportantSender).slice(0, 4);
  const selectedSpaceEvents = scopedEvents
    .map((event) => ({ event, starts: eventStart(event) }))
    .filter((item): item is { event: CalendarEvent; starts: Date } => item.starts instanceof Date)
    .sort((a, b) => a.starts.getTime() - b.starts.getTime())
    .slice(0, 4);
  const selectedSpaceTasks = scopedTasks.slice(0, 4);
  const workspaceTitle = selectedSpace?.email ?? 'Combined workspace';
  const workspaceSubtitle = selectedSpace
    ? `${providerLabel(selectedSpace.provider)} space. Mail, tasks, assistant, and create actions use this account.`
    : 'All connected spaces together. Calendar remains unified.';
  const workspacePrompt = selectedSpace
    ? `Plan my day for ${selectedSpace.email}`
    : 'Plan my day across all spaces';
  const recentScopedEmails = selectedSpace
    ? recentEmails.filter((email) => itemAccountKey(email) === selectedSpace.id || email.accountEmail === selectedSpace.email)
    : recentEmails;
  const nextSevenDayEvents = scopedEvents.filter((event) => withinDays(eventStart(event), 7));
  const nextDayEvents = scopedEvents.filter((event) => withinDays(eventStart(event), 1));
  const accountAnalytics = accountSpaces.map((account) => ({
    id: account.id,
    label: account.email,
    color: account.color,
    recentEmails: recentEmails.filter((email) => itemAccountKey(email) === account.id || email.accountEmail === account.email).length,
    unreadEmails: emails.filter((email) => itemAccountKey(email) === account.id || email.accountEmail === account.email).length,
    events: events.filter((event) => itemAccountKey(event) === account.id || event.accountEmail === account.email).filter((event) => withinDays(eventStart(event), 7)).length
  }));
  const maxRecentEmails = Math.max(...accountAnalytics.map((item) => item.recentEmails), 1);
  const maxUpcomingEvents = Math.max(...accountAnalytics.map((item) => item.events), 1);
  const providerAnalytics = Object.entries(
    recentScopedEmails.reduce<Record<string, number>>((acc, email) => {
      const key = providerLabel(email.provider);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const importantUnreadRate = percentage(priorityEmails.length, scopedEmails.length);

  async function quickComplete(task: Task) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'completed' } : item));
    await completeTask(task.id);
    loadDashboard();
  }

  function scrollToSection(section: 'workspace' | 'analysis' | 'shortcuts') {
    const target = section === 'workspace' ? workspaceRef.current : section === 'analysis' ? analysisRef.current : shortcutsRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleFocusMode(checked: boolean) {
    setFocusMode(checked);
    localStorage.setItem('o-connect-focus-mode', String(checked));
    if (checked && isCombined && accountSpaces[0]) {
      setActiveSpaceId(accountSpaces[0].id);
    }
  }

  async function moveDashboardCard(id: string, direction: -1 | 1, scopeIds?: string[]) {
    const ids = orderedDashboardCards.map((card) => card.id);
    const orderedScopeIds = scopeIds?.filter((scopeId) => ids.includes(scopeId)) ?? ids;
    const currentScopeIndex = orderedScopeIds.indexOf(id);
    const nextScopeIndex = currentScopeIndex + direction;
    if (currentScopeIndex < 0 || nextScopeIndex < 0 || nextScopeIndex >= orderedScopeIds.length) return;
    const currentIndex = ids.indexOf(id);
    const nextIndex = ids.indexOf(orderedScopeIds[nextScopeIndex]);
    if (currentIndex < 0 || nextIndex < 0) return;
    const next = [...ids];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    setCardOrderError('');
    setCardOrder(next);
    setCardOrderSaving(true);
    try {
      setCardOrder(await updateDashboardCardOrder(next));
    } catch {
      setCardOrderError('Dashboard card order could not be saved. Please try again.');
    } finally {
      setCardOrderSaving(false);
    }
  }

  const visibleDashboardCards = orderedDashboardCards.filter((card) => !(focusMode && selectedSpace && card.kind === 'space' && card.account.id !== selectedSpace.id));
  const visibleMailCards = visibleDashboardCards.filter((card) => card.kind !== 'link');
  const visibleLinkCards = visibleDashboardCards.filter((card) => card.kind === 'link');

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Pick a space, then work from a focused view."
        action={<Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDashboard}>Refresh</Button>}
      />
      {errors.length > 0 && <Alert sx={{ mb: 2 }} severity="warning">{errors.join(' ')}</Alert>}
      {cardOrderError && <Alert sx={{ mb: 2 }} severity="warning">{cardOrderError}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {cardOrderSaving && <LinearProgress sx={{ mb: 2 }} color="secondary" />}

      <Stack spacing={2.5}>
        <Card className="premium-panel" sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="flex-end" spacing={1.5} sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <FormControlLabel control={<Switch checked={focusMode} onChange={(event) => toggleFocusMode(event.target.checked)} />} label="Focus mode" />
                {(['workspace', 'analysis', 'shortcuts'] as const).map((key) => (
                  <Chip key={key} label={key} color="primary" variant="filled" onClick={() => scrollToSection(key)} />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={1.4}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>Cards</Typography>
                  <Typography color="text.secondary" variant="body2">Choose a workspace or open a saved profile without crowding the dashboard.</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${visibleDashboardCards.length} cards`} variant="outlined" />
                  <Chip size="small" label="Order saved" color={cardOrderSaving ? 'default' : 'success'} variant="outlined" />
                </Stack>
              </Stack>
              <Box
                sx={{
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.44)' : 'rgba(248, 251, 255, 0.82)',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.35,
                  maxHeight: { xs: 334, md: 286 },
                  maxWidth: 1080,
                  minWidth: 0,
                  mx: 'auto',
                  overflowY: 'auto',
                  p: 0.9,
                  pr: { xs: 1, md: 1.25 },
                  scrollBehavior: 'smooth',
                  '&::-webkit-scrollbar': { width: 8 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 999 },
                  '&::-webkit-scrollbar-track': { bgcolor: 'transparent' }
                }}
              >
                {[
                  { key: 'mail', title: 'Mail spaces', helper: 'Choose the inbox workspace first.', cards: visibleMailCards },
                  { key: 'social', title: 'Social & links', helper: 'Open saved profiles and websites.', cards: visibleLinkCards }
                ].map((group) => group.cards.length > 0 && (
                  <Box key={group.key}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.75, px: 0.35 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 950, letterSpacing: 0, textTransform: 'uppercase' }}>{group.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{group.helper}</Typography>
                      </Box>
                      <Chip size="small" label={group.cards.length} variant="outlined" sx={{ height: 22 }} />
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 0.85,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 246px), 318px))',
                        justifyContent: { xs: 'stretch', sm: 'center' }
                      }}
                    >
                {group.cards.map((card, index) => {
                  const isFirst = index === 0;
                  const isLast = index === group.cards.length - 1;
                  const scopeIds = group.cards.map((item) => item.id);
                  if (card.kind === 'combined') {
                    return (
                      <Box
                        key={card.id}
                        sx={{
                          bgcolor: isCombined ? 'primary.main' : 'background.paper',
                          border: '1px solid',
                          borderColor: isCombined ? 'primary.main' : 'divider',
                          borderRadius: 2,
                          boxShadow: isCombined ? '0 10px 22px rgba(37,87,214,0.18)' : 'none',
                          color: isCombined ? '#fff' : 'text.primary',
                          minHeight: 52,
                          p: 0.7,
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                          '&:hover': { transform: { sm: 'translateY(-2px)' }, borderColor: 'primary.main' }
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
                          <Box component="button" type="button" onClick={() => setActiveSpaceId('combined')} sx={{ all: 'unset', alignItems: 'center', cursor: 'pointer', display: 'flex', flex: 1, gap: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'grid', flex: '0 0 auto', placeItems: 'center' }}>
                              <LayersIcon fontSize="small" />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.65} alignItems="center">
                                <Typography sx={{ fontSize: '0.95rem', fontWeight: 900 }} noWrap>Combined</Typography>
                                {isCombined && <Chip size="small" label="Active" sx={{ bgcolor: 'background.paper', color: 'primary.main', fontWeight: 800, height: 22 }} />}
                              </Stack>
                              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, opacity: 0.82 }} noWrap>
                                {metricLabel(emails.length, 'email')} · {metricLabel(pendingTasks.length, 'task')}
                              </Typography>
                            </Box>
                          </Box>
                          <CardMoveControls disabledLeft={isFirst} disabledRight={isLast} onLeft={() => moveDashboardCard(card.id, -1, scopeIds)} onRight={() => moveDashboardCard(card.id, 1, scopeIds)} />
                        </Stack>
                      </Box>
                    );
                  }

                  if (card.kind === 'link') {
                    const meta = linkCardMeta(card.account);
                    const avatarUrl = socialAvatarUrl(card.account);
                    return (
                      <Box
                        key={card.id}
                        sx={{
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: meta.accent,
                          borderRadius: 2,
                          color: 'inherit',
                          minHeight: 52,
                          p: 0.7,
                          transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                          boxShadow: `inset 4px 0 0 ${meta.accent}`,
                          '&:hover': { boxShadow: `inset 4px 0 0 ${meta.accent}, 0 12px 24px rgba(24,35,56,0.09)`, transform: { sm: 'translateY(-2px)' } }
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
                          <Box component="a" href={dashboardCardUrl(card.account)} target="_blank" rel="noreferrer" sx={{ alignItems: 'center', color: 'inherit', display: 'flex', flex: 1, gap: 1, minWidth: 0, textDecoration: 'none' }}>
                            <Box sx={{ bgcolor: meta.accentBg, border: '1px solid', borderColor: `${meta.accent}45`, borderRadius: '50%', color: meta.accent, display: 'grid', flex: '0 0 auto', height: 30, overflow: 'hidden', placeItems: 'center', position: 'relative', width: 30 }}>
                              {card.account.cardType === 'social' ? (
                                <Typography sx={{ color: meta.accent, fontSize: '0.82rem', fontWeight: 950 }}>{avatarInitial(card.account)}</Typography>
                              ) : meta.icon}
                              {avatarUrl && (
                                <Box
                                  component="img"
                                  src={avatarUrl}
                                  alt=""
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                  sx={{ bgcolor: 'background.paper', height: '100%', inset: 0, objectFit: 'cover', position: 'absolute', width: '100%' }}
                                />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.65} alignItems="center">
                                <Typography sx={{ fontSize: '0.95rem', fontWeight: 900 }} noWrap>{card.account.label}</Typography>
                                <OpenInNewIcon sx={{ color: meta.accent, flex: '0 0 auto', fontSize: 16 }} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 800 }} noWrap>{meta.label} · #{index + 1}</Typography>
                            </Box>
                          </Box>
                          <CardMoveControls disabledLeft={isFirst} disabledRight={isLast} onLeft={() => moveDashboardCard(card.id, -1, scopeIds)} onRight={() => moveDashboardCard(card.id, 1, scopeIds)} />
                        </Stack>
                      </Box>
                    );
                  }

                  const account = card.account;
                  const active = activeSpaceId === account.id;
                  return (
                    <Box
                      key={card.id}
                      sx={{
                        bgcolor: active ? `${account.color}18` : 'background.paper',
                        border: '1px solid',
                        borderColor: active ? account.color : 'divider',
                        borderRadius: 2,
                        boxShadow: active ? `inset 4px 0 0 ${account.color}, 0 10px 22px ${account.color}18` : `inset 4px 0 0 ${account.color}`,
                        color: 'text.primary',
                        minHeight: 52,
                        overflow: 'hidden',
                        p: 0.7,
                        position: 'relative',
                        textAlign: 'left',
                        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                        '&:hover': { borderColor: account.color, transform: { sm: 'translateY(-2px)' } }
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%', pl: 0.35 }}>
                        <Box component="button" type="button" onClick={() => setActiveSpaceId(account.id)} sx={{ all: 'unset', alignItems: 'center', cursor: 'pointer', display: 'flex', flex: 1, gap: 1, minWidth: 0 }}>
                          <Chip size="small" label={providerLabel(account.provider)} variant="outlined" sx={{ borderColor: account.color, color: account.color, flex: '0 0 auto', fontSize: '0.72rem', fontWeight: 800, height: 24, maxWidth: 82 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.65} alignItems="center">
                              <Typography sx={{ fontSize: '0.95rem', fontWeight: 900 }} noWrap>{account.email}</Typography>
                              {active && <Chip size="small" label="Active" sx={{ bgcolor: account.color, color: '#fff', flex: '0 0 auto', fontWeight: 800, height: 22 }} />}
                            </Stack>
                            <Typography variant="caption" sx={{ color: account.color, display: 'block', fontSize: '0.72rem', fontWeight: 900 }} noWrap>
                              {metricLabel(account.emails, 'email')} · {metricLabel(account.tasks, 'task')} · #{index + 1}
                            </Typography>
                          </Box>
                        </Box>
                        <CardMoveControls disabledLeft={isFirst} disabledRight={isLast} onLeft={() => moveDashboardCard(card.id, -1, scopeIds)} onRight={() => moveDashboardCard(card.id, 1, scopeIds)} />
                      </Stack>
                    </Box>
                  );
                })}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card ref={workspaceRef} className="premium-panel" sx={{ borderColor: selectedSpaceColor, overflow: 'hidden', scrollMarginTop: 96 }}>
          <Box sx={{ bgcolor: selectedSpace ? `${selectedSpaceColor}10` : 'rgba(37,87,214,0.08)', borderBottom: '1px solid', borderColor: 'divider', p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h4" sx={{ fontWeight: 950, overflowWrap: 'anywhere' }}>{workspaceTitle}</Typography>
                  <Chip label={isCombined ? 'Combined' : 'Selected space'} color={isCombined ? 'primary' : 'default'} sx={{ fontWeight: 850 }} />
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>{workspaceSubtitle}</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" component={RouterLink} to={`/emails${selectedSpace ? `?accountId=${encodeURIComponent(selectedSpace.id)}` : ''}`} startIcon={<InboxIcon />}>Inbox</Button>
                <Button variant="outlined" component={RouterLink} to="/tasks" startIcon={<TaskAltIcon />}>Tasks</Button>
                <Button variant="contained" component={RouterLink} to="/calendar" startIcon={<EventIcon />}>Calendar</Button>
              </Stack>
            </Stack>
          </Box>

          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MailIcon sx={{ color: selectedSpaceColor }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Priority Inbox</Typography>
                      <Typography variant="caption" color="text.secondary">{metricLabel(priorityEmails.length, 'message')}</Typography>
                    </Box>
                  </Stack>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {priorityEmails.map((email) => (
                      <Box key={email.id} sx={{ py: 1.15 }}>
                        <Typography sx={{ fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{email.subject}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{email.sender}</Typography>
                      </Box>
                    ))}
                    {priorityEmails.length === 0 && <Alert severity="info">No priority unread mail here.</Alert>}
                  </Stack>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EventIcon sx={{ color: selectedSpaceColor }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Calendar</Typography>
                      <Typography variant="caption" color="text.secondary">{formatMeetingTime(nextMeeting(scopedEvents))}</Typography>
                    </Box>
                  </Stack>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {selectedSpaceEvents.map(({ event }) => (
                      <Box key={event.id} sx={{ py: 1.15 }}>
                        <Typography sx={{ fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.summary ?? event.subject ?? '(No title)'}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatMeetingTime(event)}</Typography>
                      </Box>
                    ))}
                    {selectedSpaceEvents.length === 0 && <Alert severity="info">No upcoming meetings loaded.</Alert>}
                  </Stack>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TaskAltIcon sx={{ color: selectedSpaceColor }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Tasks</Typography>
                      <Typography variant="caption" color="text.secondary">{metricLabel(scopedTasks.length, 'pending task')}</Typography>
                    </Box>
                  </Stack>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {selectedSpaceTasks.map((task) => (
                      <Box key={task.id} sx={{ alignItems: 'flex-start', display: 'flex', gap: 1, py: 1.15 }}>
                        <Checkbox size="small" onChange={() => quickComplete(task)} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                          <Typography variant="caption" color={overdue.some((item) => item.id === task.id) ? 'warning.main' : 'text.secondary'}>{formatDueDate(task.due_date)}</Typography>
                        </Box>
                      </Box>
                    ))}
                    {selectedSpaceTasks.length === 0 && <Alert severity="success">No pending tasks here.</Alert>}
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card ref={analysisRef} className="premium-panel" sx={{ scrollMarginTop: 96 }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2.25 }}>
              <Box sx={{ maxWidth: 620 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AnalyticsIcon color="primary" />
                  <Typography variant="h5" sx={{ fontWeight: 950 }}>Workspace Analysis</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.45 }}>Live operational signals from connected inboxes, calendars, and tasks, scoped to the selected space.</Typography>
              </Box>
              <Chip icon={<InsightsIcon />} label={selectedSpace ? providerLabel(selectedSpace.provider) : 'Combined analysis'} color="primary" variant="outlined" sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }} />
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} lg={3}>
                <SignalTile
                  label="Unread"
                  value={scopedEmails.length}
                  helper={`${priorityEmails.length} look like real people or work mail`}
                  color={selectedSpaceColor}
                  icon={<MailIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <SignalTile
                  label="Priority rate"
                  value={`${importantUnreadRate}%`}
                  helper="Higher means the inbox needs attention sooner"
                  color={importantUnreadRate > 40 ? '#b86b00' : '#0f9f8f'}
                  icon={<InsightsIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <SignalTile
                  label="Meetings"
                  value={nextSevenDayEvents.length}
                  helper={`${nextDayEvents.length} scheduled in the next 24 hours`}
                  color="#8b5cf6"
                  icon={<EventIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <SignalTile
                  label="Task pressure"
                  value={scopedOverdueTasks.length}
                  helper={`${scopedTasks.length} pending in this workspace`}
                  color={scopedOverdueTasks.length ? '#e0476b' : '#168053'}
                  icon={<TaskAltIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%', p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>Mail Volume</Typography>
                        <Typography variant="caption" color="text.secondary">Recent inbox, last 14 days</Typography>
                      </Box>
                      <MailIcon sx={{ color: selectedSpaceColor }} />
                    </Stack>
                    {accountAnalytics.map((item) => (
                      <ChartBar key={item.id} label={item.label} value={item.recentEmails} total={maxRecentEmails} color={item.color} />
                    ))}
                    {accountAnalytics.length === 0 && <Alert severity="info">No connected accounts to analyze yet.</Alert>}
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%', p: 2 }}>
                  <Stack spacing={1.6}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>Task Balance</Typography>
                        <Typography variant="caption" color="text.secondary">Completion and urgency</Typography>
                      </Box>
                      <DonutLargeIcon sx={{ color: selectedSpaceColor }} />
                    </Stack>
                    <DonutMetric value={scopedCompletedTasks.length} total={scopedAllTasks.length} color={selectedSpaceColor} label="Completed tasks" />
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.25 }}>
                          <Typography variant="h5" sx={{ fontWeight: 950 }}>{scopedTasks.length}</Typography>
                          <Typography variant="caption" color="text.secondary">Pending</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ bgcolor: scopedOverdueTasks.length ? 'rgba(244, 184, 96, 0.16)' : 'rgba(19, 122, 80, 0.14)', borderRadius: 2, p: 1.25 }}>
                          <Typography variant="h5" sx={{ fontWeight: 950 }}>{scopedOverdueTasks.length}</Typography>
                          <Typography variant="caption" color="text.secondary">Overdue</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%', p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>Calendar Load</Typography>
                        <Typography variant="caption" color="text.secondary">Upcoming events, next 7 days</Typography>
                      </Box>
                      <EventIcon sx={{ color: selectedSpaceColor }} />
                    </Stack>
                    {accountAnalytics.map((item) => (
                      <ChartBar key={item.id} label={item.label} value={item.events} total={maxUpcomingEvents} color={item.color} />
                    ))}
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.25 }}>
                          <Typography variant="h5" sx={{ fontWeight: 950 }}>{nextDayEvents.length}</Typography>
                          <Typography variant="caption" color="text.secondary">Next 24h</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.25 }}>
                          <Typography variant="h5" sx={{ fontWeight: 950 }}>{nextSevenDayEvents.length}</Typography>
                          <Typography variant="caption" color="text.secondary">Next 7d</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip label={`${importantUnreadRate}% important unread`} color={importantUnreadRate > 40 ? 'warning' : 'default'} />
                      <Chip label={`${recentScopedEmails.length} recent inbox messages`} />
                      <Chip label={`${providerAnalytics.length || 1} mail provider${providerAnalytics.length === 1 ? '' : 's'}`} />
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {providerAnalytics.map(([provider, count]) => (
                        <Chip key={provider} variant="outlined" label={`${provider}: ${count}`} />
                      ))}
                      {providerAnalytics.length === 0 && <Chip variant="outlined" label="No recent provider data" />}
                    </Stack>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card ref={shortcutsRef} className="premium-panel" sx={{ scrollMarginTop: 96 }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Assistant shortcuts</Typography>
                <Typography color="text.secondary" variant="body2">These run inside the active space.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                {[workspacePrompt, 'Summarize unread emails', 'Create tasks from important emails'].map((prompt) => (
                  <Button key={prompt} component={RouterLink} to={`/assistant?prompt=${encodeURIComponent(prompt)}`} variant="outlined" startIcon={<AutoAwesomeIcon />}>
                    {prompt}
                  </Button>
                ))}
                <Button component={RouterLink} to="/calendar" variant="contained" startIcon={<AddIcon />}>Create Meeting</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

      </Stack>
    </>
  );
}
