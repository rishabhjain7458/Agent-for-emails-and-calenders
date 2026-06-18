import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import { PageHeader } from '../components/PageHeader';
import { completeTask, getDashboardCards, getEmails, getEvents, getTasks, updateDashboardCardOrder } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { CalendarEvent, DashboardCard as LinkDashboardCard, EmailMessage, Task } from '../types';

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

function providerLabel(provider?: 'google' | 'microsoft' | 'zoho') {
  return provider === 'microsoft' ? 'Outlook' : provider === 'zoho' ? 'Zoho Mail' : 'Gmail';
}

function metricLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function mergeCardOrder(ids: string[], order: string[]) {
  const uniqueOrder = order.filter((id, index) => ids.includes(id) && order.indexOf(id) === index);
  return [...uniqueOrder, ...ids.filter((id) => !uniqueOrder.includes(id))];
}

export function DashboardPage() {
  const { activeSpaceId, setActiveSpaceId, isCombined, spaces } = useSpace();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkCards, setLinkCards] = useState<LinkDashboardCard[]>([]);
  const [cardOrder, setCardOrder] = useState<string[]>([]);

  async function loadDashboard() {
    setLoading(true);
    const results = await Promise.allSettled([getEmails('in:inbox is:unread'), getEvents(), getTasks()]);
    const nextErrors: string[] = [];
    const [mailResult, calendarResult, taskResult] = results;

    if (mailResult.status === 'fulfilled') setEmails(mailResult.value);
    else nextErrors.push('Unread emails could not be loaded.');

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
    });
  }, []);

  const pendingTasks = tasks.filter((task) => task.status !== 'completed');
  const overdue = overdueTasks(tasks);

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
    const ids = dashboardCards.map((card) => card.id);
    setCardOrder((current) => {
      const next = mergeCardOrder(ids, current);
      if (next.join('|') !== current.join('|')) updateDashboardCardOrder(next).catch(() => undefined);
      return next;
    });
  }, [dashboardCards]);

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

  async function quickComplete(task: Task) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'completed' } : item));
    await completeTask(task.id);
    loadDashboard();
  }

  function moveDashboardCard(id: string, direction: -1 | 1) {
    const ids = orderedDashboardCards.map((card) => card.id);
    const currentIndex = ids.indexOf(id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    const next = [...ids];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    setCardOrder(next);
    updateDashboardCardOrder(next).catch(() => undefined);
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Pick a space, then work from a focused view."
        action={<Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDashboard}>Refresh</Button>}
      />
      {errors.length > 0 && <Alert sx={{ mb: 2 }} severity="warning">{errors.join(' ')}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Stack spacing={2.5}>
        <Card className="premium-panel" sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
              <Box sx={{ minWidth: { lg: 260 } }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>Cards</Typography>
                <Typography color="text.secondary" variant="body2">Email spaces and social profiles in one sequence.</Typography>
              </Box>
              <Box className="scroll-thin" sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5 }}>
                {orderedDashboardCards.map((card, index) => {
                  const isFirst = index === 0;
                  const isLast = index === orderedDashboardCards.length - 1;
                  if (card.kind === 'combined') {
                    return (
                      <Box
                        key={card.id}
                        sx={{
                          bgcolor: isCombined ? 'primary.main' : '#ffffff',
                          border: '1px solid',
                          borderColor: isCombined ? 'primary.main' : 'divider',
                          borderRadius: 2,
                          boxShadow: isCombined ? '0 18px 36px rgba(37,87,214,0.22)' : 'none',
                          color: isCombined ? '#fff' : 'text.primary',
                          flex: '0 0 244px',
                          minHeight: 128,
                          p: 1.15,
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                          '&:hover': { transform: { sm: 'translateY(-2px)' }, borderColor: 'primary.main' }
                        }}
                      >
                        <Stack spacing={0.85} sx={{ height: '100%' }}>
                          <Box component="button" type="button" onClick={() => setActiveSpaceId('combined')} sx={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                            <Stack spacing={0.85}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <LayersIcon />
                                {isCombined && <Chip size="small" label="Active" sx={{ bgcolor: '#fff', color: 'primary.main', fontWeight: 800 }} />}
                              </Stack>
                              <Box>
                                <Typography sx={{ fontWeight: 900 }}>Combined</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.78 }}>All spaces together</Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 850 }}>
                                {metricLabel(emails.length, 'email')} · {metricLabel(pendingTasks.length, 'task')}
                              </Typography>
                            </Stack>
                          </Box>
                          <Stack direction="row" spacing={0.75} sx={{ mt: 'auto' }}>
                            <Button size="small" variant={isCombined ? 'contained' : 'outlined'} disabled={isFirst} startIcon={<ArrowBackIcon />} onClick={() => moveDashboardCard(card.id, -1)} sx={{ minHeight: 32 }}>Left</Button>
                            <Button size="small" variant={isCombined ? 'contained' : 'outlined'} disabled={isLast} endIcon={<ArrowForwardIcon />} onClick={() => moveDashboardCard(card.id, 1)} sx={{ minHeight: 32 }}>Right</Button>
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  }

                  if (card.kind === 'link') {
                    const instagram = card.account.platform === 'instagram';
                    const facebook = card.account.platform === 'facebook';
                    const news = card.account.cardType === 'news';
                    const accent = instagram ? '#c026d3' : facebook ? '#2563eb' : news ? '#a16207' : '#2557d6';
                    const accentBg = instagram ? '#fdf2f8' : facebook ? '#eff6ff' : news ? '#fefce8' : '#f8faff';
                    const cardLabel = news ? 'News' : instagram ? 'Instagram' : facebook ? 'Facebook' : 'Custom link';
                    return (
                      <Box
                        key={card.id}
                        sx={{
                          bgcolor: '#fff',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          color: 'inherit',
                          flex: '0 0 244px',
                          minHeight: 128,
                          p: 1.15,
                          transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                          '&:hover': { borderColor: accent, boxShadow: '0 16px 32px rgba(24,35,56,0.09)', transform: { sm: 'translateY(-2px)' } }
                        }}
                      >
                        <Stack spacing={0.85} sx={{ height: '100%' }}>
                          <Box component="a" href={card.account.url} target="_blank" rel="noreferrer" sx={{ color: 'inherit', textDecoration: 'none' }}>
                            <Stack spacing={0.85}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Box sx={{ bgcolor: accentBg, borderRadius: 1.5, color: accent, display: 'grid', height: 36, placeItems: 'center', width: 36 }}>
                                  {instagram ? <InstagramIcon /> : facebook ? <FacebookIcon /> : news ? <NewspaperIcon /> : <OpenInNewIcon />}
                                </Box>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <Chip size="small" label={`#${index + 1}`} sx={{ fontWeight: 850 }} />
                                  <OpenInNewIcon fontSize="small" color="action" />
                                </Stack>
                              </Stack>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 900 }} noWrap>{card.account.label}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>{cardLabel}</Typography>
                              </Box>
                            </Stack>
                          </Box>
                          <Stack direction="row" spacing={0.75} sx={{ mt: 'auto' }}>
                            <Button size="small" variant="outlined" disabled={isFirst} startIcon={<ArrowBackIcon />} onClick={() => moveDashboardCard(card.id, -1)} sx={{ minHeight: 32 }}>Left</Button>
                            <Button size="small" variant="outlined" disabled={isLast} endIcon={<ArrowForwardIcon />} onClick={() => moveDashboardCard(card.id, 1)} sx={{ minHeight: 32 }}>Right</Button>
                          </Stack>
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
                        bgcolor: active ? `${account.color}10` : '#ffffff',
                        border: '1px solid',
                        borderColor: active ? account.color : 'divider',
                        borderRadius: 2,
                        boxShadow: active ? `0 18px 36px ${account.color}22` : 'none',
                        color: 'text.primary',
                        flex: '0 0 264px',
                        minHeight: 128,
                        overflow: 'hidden',
                        p: 1.15,
                        position: 'relative',
                        textAlign: 'left',
                        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                        '&:hover': { borderColor: account.color, transform: { sm: 'translateY(-2px)' } },
                        '&::before': {
                          bgcolor: account.color,
                          content: '""',
                          inset: '0 auto 0 0',
                          position: 'absolute',
                          width: 4
                        }
                      }}
                    >
                      <Stack spacing={0.85} sx={{ pl: 0.5, height: '100%' }}>
                        <Box component="button" type="button" onClick={() => setActiveSpaceId(account.id)} sx={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                          <Stack spacing={0.85}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Chip size="small" label={providerLabel(account.provider)} variant="outlined" sx={{ borderColor: account.color, color: account.color, fontWeight: 800 }} />
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Chip size="small" label={`#${index + 1}`} sx={{ fontWeight: 850 }} />
                                {active && <Chip size="small" label="Active" sx={{ bgcolor: account.color, color: '#fff', fontWeight: 800 }} />}
                              </Stack>
                            </Stack>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.email}</Typography>
                              <Typography variant="caption" color="text.secondary">{account.isPrimary ? 'Primary account' : account.name}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: account.color, fontWeight: 900 }}>
                              {metricLabel(account.emails, 'email')} · {metricLabel(account.tasks, 'task')}
                            </Typography>
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 'auto' }}>
                          <Button size="small" variant="outlined" disabled={isFirst} startIcon={<ArrowBackIcon />} onClick={() => moveDashboardCard(card.id, -1)} sx={{ minHeight: 32 }}>Left</Button>
                          <Button size="small" variant="outlined" disabled={isLast} endIcon={<ArrowForwardIcon />} onClick={() => moveDashboardCard(card.id, 1)} sx={{ minHeight: 32 }}>Right</Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card className="premium-panel" sx={{ borderColor: selectedSpaceColor, overflow: 'hidden' }}>
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
                <Button variant="outlined" href={`/emails${selectedSpace ? `?accountId=${encodeURIComponent(selectedSpace.id)}` : ''}`} startIcon={<InboxIcon />}>Inbox</Button>
                <Button variant="outlined" href="/tasks" startIcon={<TaskAltIcon />}>Tasks</Button>
                <Button variant="contained" href="/calendar" startIcon={<EventIcon />}>Calendar</Button>
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

        <Card className="premium-panel">
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Assistant shortcuts</Typography>
                <Typography color="text.secondary" variant="body2">These run inside the active space.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                {[workspacePrompt, 'Summarize unread emails', 'Create tasks from important emails'].map((prompt) => (
                  <Button key={prompt} href={`/assistant?prompt=${encodeURIComponent(prompt)}`} variant="outlined" startIcon={<AutoAwesomeIcon />}>
                    {prompt}
                  </Button>
                ))}
                <Button href="/calendar" variant="contained" startIcon={<AddIcon />}>Create Meeting</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

      </Stack>
    </>
  );
}
