import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MailIcon from '@mui/icons-material/Mail';
import EventIcon from '@mui/icons-material/Event';
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
import NewspaperIcon from '@mui/icons-material/Newspaper';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import InsightsIcon from '@mui/icons-material/Insights';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { completeTask, getDashboardCards, getEmails, getEvents, getTasks, updateDashboardCardOrder } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { CalendarEvent, DashboardCard as LinkDashboardCard, EmailMessage, Task } from '../types';
import { socialPlatformLabels } from '../utils/socialAccounts';

const accountPalette = ['#2557d6', '#0f9f8f', '#b86b00', '#8b5cf6', '#e0476b', '#168053'];

type MixedDashboardCard =
  | { id: string; kind: 'combined' }
  | { id: string; kind: 'space'; account: ReturnType<typeof useSpace>['spaces'][number] & { color: string; emails: number; tasks: number } }
  | { id: string; kind: 'link'; account: LinkDashboardCard };

type CardSectionKey = 'mail' | 'portal' | 'media' | 'social' | 'news' | 'custom';

const defaultSectionOrder: CardSectionKey[] = ['mail', 'portal', 'media', 'social', 'news', 'custom'];
const sectionOrderStorageKey = 'o-connect-dashboard-section-order';

function readSectionOrder() {
  try {
    const stored = JSON.parse(localStorage.getItem(sectionOrderStorageKey) || '[]');
    if (!Array.isArray(stored)) return defaultSectionOrder;
    const allowed = new Set(defaultSectionOrder);
    const valid = stored.filter((key): key is CardSectionKey => allowed.has(key));
    return [...valid, ...defaultSectionOrder.filter((key) => !valid.includes(key))];
  } catch {
    return defaultSectionOrder;
  }
}

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
  if (card.cardType === 'portal') return { accent: '#0e7490', accentBg: 'rgba(14, 116, 144, 0.14)', label: 'Portal', icon: <BusinessCenterIcon /> };
  if (card.cardType === 'media') return { accent: '#e11d48', accentBg: 'rgba(225, 29, 72, 0.14)', label: 'Media', icon: <PermMediaIcon /> };
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
      <Box sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.16)' : '#edf2fb', borderRadius: 999, height: 9, overflow: 'hidden' }}>
        <Box
          sx={{
            background: `linear-gradient(90deg, ${color}, ${color}c4)`,
            borderRadius: 999,
            boxShadow: `0 0 18px ${color}2e`,
            height: '100%',
            transformOrigin: 'left center',
            animation: 'bar-grow 680ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            width: `${pct}%`
          }}
        />
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
          background: `conic-gradient(${color} 0deg ${pct * 3.6}deg, rgba(148,163,184,0.18) ${pct * 3.6}deg 360deg)`,
          borderRadius: '50%',
          boxShadow: `0 14px 34px ${color}1f`,
          display: 'flex',
          flex: '0 0 auto',
          height: 86,
          justifyContent: 'center',
          position: 'relative',
          width: 86,
          animation: 'donut-pop 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          '&::after': { bgcolor: 'background.paper', borderRadius: '50%', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)', content: '""', height: 58, position: 'absolute', width: 58 }
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
        background: (theme) => theme.palette.mode === 'dark'
          ? `linear-gradient(145deg, rgba(17,26,44,0.96), rgba(17,26,44,0.82)), linear-gradient(135deg, ${color}1f, transparent 54%)`
          : `linear-gradient(145deg, rgba(255,255,255,0.99), rgba(248,251,255,0.94)), linear-gradient(135deg, ${color}12, transparent 58%)`,
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(80, 96, 128, 0.62)' : 'rgba(210, 220, 236, 0.92)',
        borderRadius: 2,
        boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 18px 42px rgba(0,0,0,0.22)' : '0 16px 34px rgba(30, 41, 59, 0.065)',
        minHeight: 118,
        overflow: 'hidden',
        p: 1.65,
        position: 'relative',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          borderColor: `${color}55`,
          boxShadow: `0 20px 42px ${color}18`,
          transform: { sm: 'translateY(-2px)' }
        },
        '&::after': {
          background: `linear-gradient(135deg, ${color}14, transparent)`,
          borderRadius: 999,
          content: '""',
          height: 118,
          position: 'absolute',
          right: -54,
          top: -56,
          width: 118
        }
      }}
    >
      <Stack spacing={1.15} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850, textTransform: 'uppercase' }}>{label}</Typography>
          <Box sx={{ bgcolor: `${color}12`, border: '1px solid', borderColor: `${color}24`, borderRadius: 1.5, color, display: 'grid', height: 34, placeItems: 'center', width: 34 }}>
            {icon}
          </Box>
        </Stack>
        <Typography variant="h4" sx={{ color, fontWeight: 950, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.35 }}>{helper}</Typography>
      </Stack>
    </Box>
  );
}

function AnalysisPanel({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(145deg, rgba(17,26,44,0.9), rgba(14,22,38,0.72))'
          : 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,251,255,0.9))',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 18px 42px rgba(0,0,0,0.2)' : '0 14px 34px rgba(30,41,59,0.055)',
        height: '100%',
        overflow: 'hidden',
        p: 2,
        position: 'relative',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        '&:hover': {
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 22px 52px rgba(0,0,0,0.28)' : '0 20px 44px rgba(30,41,59,0.08)',
          transform: { sm: 'translateY(-2px)' }
        }
      }}
    >
      <Stack spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          </Box>
          {icon}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

function DragHandle() {
  return (
    <Tooltip title="Drag to reorder">
      <Box sx={{ alignItems: 'center', bottom: 4, color: 'text.secondary', display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', left: 0, opacity: 0.52, position: 'absolute', right: 0 }}>
        <DragIndicatorIcon sx={{ fontSize: 15 }} />
      </Box>
    </Tooltip>
  );
}

export function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedSectionKey, setDraggedSectionKey] = useState<CardSectionKey | null>(null);
  const [sectionOrder, setSectionOrder] = useState<CardSectionKey[]>(readSectionOrder);

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
  const focusScore = Math.max(0, Math.min(100, 100 - importantUnreadRate - scopedOverdueTasks.length * 12 - nextDayEvents.length * 4));

  async function quickComplete(task: Task) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'completed' } : item));
    await completeTask(task.id);
    loadDashboard();
  }

  async function saveDashboardCardOrder(next: string[]) {
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

  async function reorderDashboardCard(dragId: string, targetId: string, scopeIds: string[]) {
    if (dragId === targetId || !scopeIds.includes(dragId) || !scopeIds.includes(targetId)) return;
    const ids = orderedDashboardCards.map((card) => card.id);
    const scoped = ids.filter((id) => scopeIds.includes(id));
    const from = scoped.indexOf(dragId);
    const to = scoped.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const reorderedScope = [...scoped];
    const [moved] = reorderedScope.splice(from, 1);
    reorderedScope.splice(to, 0, moved);
    let scopeIndex = 0;
    const next = ids.map((id) => scopeIds.includes(id) ? reorderedScope[scopeIndex++] : id);
    await saveDashboardCardOrder(next);
  }

  const visibleDashboardCards = orderedDashboardCards;
  const visibleMailCards = visibleDashboardCards.filter((card) => card.kind !== 'link');
  const visiblePortalCards = visibleDashboardCards.filter((card) => card.kind === 'link' && card.account.cardType === 'portal');
  const visibleMediaCards = visibleDashboardCards.filter((card) => card.kind === 'link' && card.account.cardType === 'media');
  const visibleSocialCards = visibleDashboardCards.filter((card) => card.kind === 'link' && card.account.cardType === 'social');
  const visibleNewsCards = visibleDashboardCards.filter((card) => card.kind === 'link' && card.account.cardType === 'news');
  const visibleCustomCards = visibleDashboardCards.filter((card) => card.kind === 'link' && card.account.cardType === 'custom_link');
  const cardSections = [
    { key: 'mail' as const, title: 'Mail spaces', helper: 'Choose the inbox workspace first.', cards: visibleMailCards },
    { key: 'portal' as const, title: 'Portals', helper: 'Open work portals and client systems.', cards: visiblePortalCards },
    { key: 'media' as const, title: 'Media', helper: 'Open saved channels, streaming pages, and media libraries.', cards: visibleMediaCards },
    { key: 'social' as const, title: 'Social media', helper: 'Open saved social profiles.', cards: visibleSocialCards },
    { key: 'news' as const, title: 'News', helper: 'Open saved news sources.', cards: visibleNewsCards },
    { key: 'custom' as const, title: 'Custom links', helper: 'Open other saved websites.', cards: visibleCustomCards }
  ];
  const orderedCardSections = sectionOrder
    .map((key) => cardSections.find((section) => section.key === key))
    .filter((section): section is typeof cardSections[number] => Boolean(section))
    .filter((section) => section.cards.length > 0);

  function reorderCardSection(dragKey: CardSectionKey, targetKey: CardSectionKey) {
    if (dragKey === targetKey) return;
    const current = sectionOrder.filter((key) => defaultSectionOrder.includes(key));
    const from = current.indexOf(dragKey);
    const to = current.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSectionOrder(next);
    localStorage.setItem(sectionOrderStorageKey, JSON.stringify(next));
  }

  return (
    <>
      {errors.length > 0 && <Alert sx={{ mb: 2 }} severity="warning">{errors.join(' ')}</Alert>}
      {cardOrderError && <Alert sx={{ mb: 2 }} severity="warning">{cardOrderError}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1.25 }} />}
      {cardOrderSaving && <LinearProgress sx={{ mb: 1.25 }} color="secondary" />}

      <Stack spacing={{ xs: 1, md: 1.25 }}>
        <Card
          className="premium-panel"
          sx={{
            background: (theme) => theme.palette.mode === 'dark'
              ? undefined
              : 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,251,255,0.96) 100%)',
            borderColor: (theme) => theme.palette.mode === 'dark' ? 'divider' : 'rgba(194, 207, 228, 0.88)',
            boxShadow: (theme) => theme.palette.mode === 'dark' ? undefined : '0 18px 44px rgba(30, 41, 59, 0.075)',
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: { xs: 0.7, md: 0.9 } }}>
            <Stack spacing={0.7} sx={{ width: '100%' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.75} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: { xs: '0.98rem', sm: '1.05rem' }, fontWeight: 950, lineHeight: 1.05 }}>Cards</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.2 }}>Choose a workspace or saved profile.</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }} useFlexGap>
                  <Button size="small" variant="contained" component={RouterLink} to="/assistant" startIcon={<SmartToyIcon />} sx={{ minHeight: 34 }}>AI Assistant</Button>
                  <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadDashboard} sx={{ minHeight: 34 }}>Refresh</Button>
                </Stack>
              </Stack>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  minWidth: 0,
                  width: '100%'
                }}
              >
                {orderedCardSections.map((group) => (
                  <Box
                    key={group.key}
                    onDragOver={(event) => {
                      if (isMobile) return;
                      if (draggedSectionKey) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(event) => {
                      if (isMobile) return;
                      event.preventDefault();
                      const dragKey = (event.dataTransfer.getData('text/section') || draggedSectionKey) as CardSectionKey | null;
                      if (dragKey) reorderCardSection(dragKey, group.key);
                      setDraggedSectionKey(null);
                    }}
                    sx={{
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 26, 44, 0.66)' : 'rgba(248, 251, 255, 0.86)',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(51, 68, 95, 0.75)' : 'rgba(214, 224, 239, 0.92)',
                      borderRadius: 2,
                      boxShadow: (theme) => theme.palette.mode === 'dark' ? 'none' : '0 10px 24px rgba(30, 41, 59, 0.04)',
                      opacity: draggedSectionKey === group.key ? 0.62 : 1,
                      p: { xs: 0.55, md: 0.68 },
                      transition: 'opacity 150ms ease, border-color 150ms ease, transform 150ms ease',
                      width: '100%'
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.45, px: 0.2 }}>
                      <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.8, minWidth: 0 }}>
                        <Tooltip title="Drag section to reorder">
                          <Box
                            draggable={!isMobile}
                            onDragStart={(event) => {
                              if (isMobile) return;
                              setDraggedSectionKey(group.key);
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/section', group.key);
                            }}
                            onDragEnd={() => setDraggedSectionKey(null)}
                            sx={{ alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1.25, color: 'text.secondary', cursor: 'grab', display: { xs: 'none', sm: 'flex' }, height: 24, justifyContent: 'center', opacity: 0.78, width: 24, '&:active': { cursor: 'grabbing' } }}
                          >
                            <DragIndicatorIcon sx={{ fontSize: 18 }} />
                          </Box>
                        </Tooltip>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.74rem', fontWeight: 950, letterSpacing: 0, textTransform: 'uppercase' }}>{group.title}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }} noWrap>{group.helper}</Typography>
                        </Box>
                      </Box>
                      <Chip size="small" label={group.cards.length} variant="outlined" sx={{ height: 22 }} />
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: { xs: 0.65, sm: 0.8 },
                        gridTemplateColumns: {
                          xs: 'repeat(2, minmax(0, 1fr))',
                          sm: 'repeat(auto-fill, minmax(118px, 140px))',
                          lg: 'repeat(auto-fill, minmax(126px, 146px))'
                        },
                        justifyContent: 'start'
                      }}
                    >
                {group.cards.map((card, index) => {
                  const scopeIds = group.cards.map((item) => item.id);
                  const dragProps = {
                    draggable: !isMobile,
                    onDragStart: (event: DragEvent<HTMLDivElement>) => {
                      if (isMobile) return;
                      event.stopPropagation();
                      setDraggedCardId(card.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', card.id);
                    },
                    onDragEnd: () => setDraggedCardId(null),
                    onDragOver: (event: DragEvent<HTMLDivElement>) => {
                      if (isMobile) return;
                      if (draggedCardId && scopeIds.includes(draggedCardId)) {
                        event.stopPropagation();
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }
                    },
                    onDrop: (event: DragEvent<HTMLDivElement>) => {
                      if (isMobile) return;
                      event.stopPropagation();
                      event.preventDefault();
                      const dragId = event.dataTransfer.getData('text/plain') || draggedCardId;
                      if (dragId) reorderDashboardCard(dragId, card.id, scopeIds);
                      setDraggedCardId(null);
                    }
                  };
                  if (card.kind === 'combined') {
                    return (
                      <Box
                        key={card.id}
                        {...dragProps}
                        sx={{
                          background: isCombined
                            ? 'linear-gradient(145deg, #2557d6, #214fc4)'
                            : (theme) => theme.palette.mode === 'dark' ? 'rgba(17,26,44,0.86)' : 'rgba(255,255,255,0.96)',
                          border: '1px solid',
                          borderColor: isCombined ? 'rgba(37,87,214,0.58)' : 'divider',
                          borderRadius: 2,
                          boxShadow: isCombined ? '0 16px 34px rgba(37,87,214,0.2)' : '0 8px 20px rgba(30,41,59,0.035)',
                          color: isCombined ? '#fff' : 'text.primary',
                           height: { xs: 74, sm: 80 },
                           p: 0.55,
                           pb: { xs: 1.15, sm: 1.95 },
                          position: 'relative',
                          cursor: 'grab',
                          opacity: draggedCardId === card.id ? 0.56 : 1,
                          transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease',
                          '&:active': { cursor: 'grabbing' },
                          '&::before': {
                            background: isCombined ? 'rgba(255,255,255,0.34)' : 'linear-gradient(90deg, rgba(37,87,214,0.4), transparent)',
                            content: '""',
                            height: 3,
                            left: 14,
                            position: 'absolute',
                            right: 14,
                            top: 0
                          },
                          '&:hover': { boxShadow: isCombined ? '0 20px 42px rgba(37,87,214,0.24)' : '0 14px 30px rgba(30,41,59,0.08)', transform: { sm: 'translateY(-2px)' }, borderColor: 'rgba(37,87,214,0.42)' }
                        }}
                      >
                        <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', textAlign: 'center' }}>
                          <Box component="button" type="button" onClick={() => setActiveSpaceId('combined')} sx={{ all: 'unset', alignItems: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.45, minWidth: 0, width: '100%' }}>
                            <Box sx={{ bgcolor: isCombined ? 'rgba(255,255,255,0.16)' : 'action.hover', borderRadius: 1.5, display: 'grid', height: 24, placeItems: 'center', width: 24 }}>
                              <LayersIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.55} alignItems="center" justifyContent="center">
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 950, lineHeight: 1.1 }}>Combined</Typography>
                                {isCombined && <Chip size="small" label="Active" sx={{ bgcolor: 'background.paper', color: 'primary.main', fontWeight: 800, height: 20, '& .MuiChip-label': { px: 0.7 } }} />}
                              </Stack>
                              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.63rem', fontWeight: 800, opacity: 0.82 }} noWrap>
                                {metricLabel(emails.length, 'email')} · {metricLabel(pendingTasks.length, 'task')}
                              </Typography>
                            </Box>
                          </Box>
                          <DragHandle />
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
                        {...dragProps}
                        sx={{
                          background: (theme) => theme.palette.mode === 'dark'
                            ? `linear-gradient(145deg, rgba(17,26,44,0.9), rgba(14,22,38,0.76)), linear-gradient(135deg, ${meta.accent}14, transparent 56%)`
                            : `linear-gradient(145deg, rgba(255,255,255,0.98), rgba(249,251,255,0.92)), linear-gradient(135deg, ${meta.accent}0f, transparent 58%)`,
                          border: '1px solid',
                          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(80, 96, 128, 0.64)' : 'rgba(208, 218, 234, 0.96)',
                          borderRadius: 2,
                          color: 'inherit',
                           height: { xs: 74, sm: 80 },
                           p: 0.55,
                           pb: { xs: 1.15, sm: 1.95 },
                          position: 'relative',
                          cursor: 'grab',
                          opacity: draggedCardId === card.id ? 0.56 : 1,
                          transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                          '&:active': { cursor: 'grabbing' },
                          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 10px 24px rgba(0,0,0,0.18)' : '0 8px 20px rgba(30,41,59,0.04)',
                          '&::before': {
                            background: `linear-gradient(90deg, ${meta.accent}8f, ${meta.accent}16)`,
                            content: '""',
                            height: 3,
                            left: 14,
                            position: 'absolute',
                            right: 14,
                            top: 0
                          },
                          '&:hover': { borderColor: `${meta.accent}5c`, boxShadow: `0 16px 34px ${meta.accent}18`, transform: { sm: 'translateY(-2px)' } }
                        }}
                      >
                        <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', textAlign: 'center' }}>
                          <Box component="a" href={dashboardCardUrl(card.account)} target="_blank" rel="noreferrer" sx={{ alignItems: 'center', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 0.45, minWidth: 0, textDecoration: 'none', width: '100%' }}>
                             <Box sx={{ bgcolor: meta.accentBg, border: '1px solid', borderColor: `${meta.accent}28`, borderRadius: '50%', boxShadow: `0 7px 15px ${meta.accent}10`, color: meta.accent, display: 'grid', flex: '0 0 auto', height: 26, overflow: 'hidden', placeItems: 'center', position: 'relative', width: 26 }}>
                              {card.account.cardType === 'social' ? (
                                <Typography sx={{ color: meta.accent, fontSize: '0.78rem', fontWeight: 950 }}>{avatarInitial(card.account)}</Typography>
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
                              <Stack direction="row" spacing={0.4} alignItems="center" justifyContent="center">
                                <Typography sx={{ display: '-webkit-box', fontSize: '0.68rem', fontWeight: 900, lineHeight: 1.06, overflow: 'hidden', textAlign: 'center', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{card.account.label}</Typography>
                                <OpenInNewIcon sx={{ color: meta.accent, flex: '0 0 auto', fontSize: 12 }} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.61rem', fontWeight: 800 }} noWrap>{meta.label} · #{index + 1}</Typography>
                            </Box>
                          </Box>
                          <DragHandle />
                        </Stack>
                      </Box>
                    );
                  }

                  const account = card.account;
                  const active = activeSpaceId === account.id;
                  return (
                    <Box
                        key={card.id}
                        {...dragProps}
                        sx={{
                        background: (theme) => active
                          ? theme.palette.mode === 'dark'
                            ? `linear-gradient(145deg, ${account.color}24, rgba(17,26,44,0.9))`
                            : `linear-gradient(145deg, ${account.color}16, rgba(255,255,255,0.96))`
                          : theme.palette.mode === 'dark' ? 'rgba(17,26,44,0.86)' : 'rgba(255,255,255,0.96)',
                        border: '1px solid',
                        borderColor: active ? `${account.color}55` : 'divider',
                        borderRadius: 2,
                        boxShadow: active ? `0 14px 30px ${account.color}16` : '0 8px 20px rgba(30,41,59,0.035)',
                        color: 'text.primary',
                        height: { xs: 74, sm: 80 },
                        overflow: 'hidden',
                        p: 0.55,
                        pb: { xs: 1.15, sm: 1.95 },
                        position: 'relative',
                        cursor: 'grab',
                        opacity: draggedCardId === card.id ? 0.56 : 1,
                        textAlign: 'left',
                        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                        '&:active': { cursor: 'grabbing' },
                        '&::before': {
                          background: `linear-gradient(90deg, ${account.color}88, ${account.color}16)`,
                          content: '""',
                          height: 3,
                          left: 14,
                          position: 'absolute',
                          right: 14,
                          top: 0
                        },
                        '&:hover': { borderColor: `${account.color}66`, boxShadow: `0 16px 34px ${account.color}14`, transform: { sm: 'translateY(-2px)' } }
                      }}
                    >
                      <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', textAlign: 'center' }}>
                        <Box component="button" type="button" onClick={() => setActiveSpaceId(account.id)} sx={{ all: 'unset', alignItems: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.45, minWidth: 0, width: '100%' }}>
                          <Box sx={{ bgcolor: `${account.color}10`, border: '1px solid', borderColor: `${account.color}2d`, borderRadius: 1.5, color: account.color, display: 'grid', height: 24, placeItems: 'center', width: 24 }}>
                            <MailIcon sx={{ fontSize: 16 }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                              <Typography sx={{ display: '-webkit-box', fontSize: '0.66rem', fontWeight: 900, lineHeight: 1.08, overflow: 'hidden', overflowWrap: 'anywhere', textAlign: 'center', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{account.email}</Typography>
                              {active && <Chip size="small" label="Active" sx={{ bgcolor: account.color, color: '#fff', flex: '0 0 auto', fontWeight: 800, height: 20, '& .MuiChip-label': { px: 0.7 } }} />}
                            </Stack>
                            <Typography variant="caption" sx={{ color: account.color, display: 'block', fontSize: '0.61rem', fontWeight: 900 }} noWrap>
                              {providerLabel(account.provider)} · {metricLabel(account.emails, 'email')}
                            </Typography>
                          </Box>
                        </Box>
                        <DragHandle />
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

        <Card className="premium-panel" sx={{ borderColor: selectedSpaceColor, overflow: 'hidden', scrollMarginTop: 96 }}>
          <Box sx={{ bgcolor: selectedSpace ? `${selectedSpaceColor}10` : 'rgba(37,87,214,0.08)', borderBottom: '1px solid', borderColor: 'divider', p: { xs: 1.5, md: 2 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h4" sx={{ fontSize: { xs: '1.35rem', sm: '1.7rem', md: '2rem' }, fontWeight: 950, overflowWrap: 'anywhere' }}>{workspaceTitle}</Typography>
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

          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
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

        <Card
          className="premium-panel"
          sx={{
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(145deg, rgba(17,26,44,0.94), rgba(12,20,34,0.82))'
              : 'linear-gradient(145deg, rgba(255,255,255,0.99), rgba(246,250,255,0.92))',
            overflow: 'hidden',
            position: 'relative',
            scrollMarginTop: 96,
            '&::after': {
              background: `radial-gradient(circle at 88% 8%, ${selectedSpaceColor}16, transparent 32%)`,
              content: '""',
              inset: 0,
              pointerEvents: 'none',
              position: 'absolute'
            }
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2.25, position: 'relative', zIndex: 1 }}>
              <Box sx={{ maxWidth: 620 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ bgcolor: `${selectedSpaceColor}12`, border: '1px solid', borderColor: `${selectedSpaceColor}28`, borderRadius: 1.5, color: selectedSpaceColor, display: 'grid', height: 36, placeItems: 'center', width: 36 }}>
                    <AnalyticsIcon fontSize="small" />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 950 }}>Workspace Analysis</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.45 }}>Live operational signals from connected inboxes, calendars, and tasks, scoped to the selected space.</Typography>
              </Box>
              <Chip icon={<InsightsIcon />} label={selectedSpace ? providerLabel(selectedSpace.provider) : 'Combined analysis'} color="primary" variant="outlined" sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }} />
            </Stack>
            <Grid container spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
              <Grid item xs={12} lg={4}>
                <Box
                  sx={{
                    background: `linear-gradient(145deg, ${selectedSpaceColor}18, rgba(255,255,255,0.92))`,
                    border: '1px solid',
                    borderColor: `${selectedSpaceColor}2f`,
                    borderRadius: 2,
                    boxShadow: `0 18px 42px ${selectedSpaceColor}12`,
                    height: '100%',
                    overflow: 'hidden',
                    p: 2,
                    position: 'relative'
                  }}
                >
                  <Stack spacing={1.6}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 900, textTransform: 'uppercase' }} color="text.secondary">Today focus</Typography>
                        <Typography variant="h3" sx={{ color: selectedSpaceColor, fontWeight: 950, lineHeight: 1, mt: 0.75 }}>{focusScore}</Typography>
                      </Box>
                      <Box sx={{ bgcolor: `${selectedSpaceColor}14`, border: '1px solid', borderColor: `${selectedSpaceColor}2f`, borderRadius: 2, color: selectedSpaceColor, display: 'grid', height: 44, placeItems: 'center', width: 44 }}>
                        <InsightsIcon />
                      </Box>
                    </Stack>
                    <Typography color="text.secondary" variant="body2">A quick pressure score from unread priority mail, overdue work, and meetings in the next 24 hours.</Typography>
                    <Box sx={{ bgcolor: 'rgba(148,163,184,0.16)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                      <Box sx={{ animation: 'bar-grow 720ms cubic-bezier(0.2,0.8,0.2,1) both', background: `linear-gradient(90deg, ${selectedSpaceColor}, #0f9f8f)`, borderRadius: 999, height: '100%', width: `${focusScore}%` }} />
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`${priorityEmails.length} priority`} />
                      <Chip size="small" label={`${scopedOverdueTasks.length} overdue`} color={scopedOverdueTasks.length ? 'warning' : 'default'} />
                      <Chip size="small" label={`${nextDayEvents.length} today`} />
                    </Stack>
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12} lg={8}>
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
                </Grid>
              </Grid>
              <Grid item xs={12} md={4}>
                <AnalysisPanel title="Mail Volume" subtitle="Recent inbox, last 14 days" icon={<MailIcon sx={{ color: selectedSpaceColor }} />}>
                    {accountAnalytics.map((item) => (
                      <ChartBar key={item.id} label={item.label} value={item.recentEmails} total={maxRecentEmails} color={item.color} />
                    ))}
                    {accountAnalytics.length === 0 && <Alert severity="info">No connected accounts to analyze yet.</Alert>}
                </AnalysisPanel>
              </Grid>
              <Grid item xs={12} md={4}>
                <AnalysisPanel title="Task Balance" subtitle="Completion and urgency" icon={<DonutLargeIcon sx={{ color: selectedSpaceColor }} />}>
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
                </AnalysisPanel>
              </Grid>
              <Grid item xs={12} md={4}>
                <AnalysisPanel title="Calendar Load" subtitle="Upcoming events, next 7 days" icon={<EventIcon sx={{ color: selectedSpaceColor }} />}>
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
                </AnalysisPanel>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17,26,44,0.72)' : 'rgba(248,251,255,0.88)', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
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

      </Stack>
    </>
  );
}
