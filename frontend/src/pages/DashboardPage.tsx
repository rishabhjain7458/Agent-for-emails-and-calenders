import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MailIcon from '@mui/icons-material/Mail';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BoltIcon from '@mui/icons-material/Bolt';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { completeTask, getEmails, getEvents, getTasks } from '../api/endpoints';
import type { CalendarEvent, EmailMessage, Task } from '../types';

function eventStart(event: CalendarEvent) {
  const value = event.start?.dateTime ?? event.start?.date;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nextMeetingText(events: CalendarEvent[]) {
  const next = events
    .map((event) => ({ event, starts: eventStart(event) }))
    .filter((item): item is { event: CalendarEvent; starts: Date } => item.starts instanceof Date && item.starts.getTime() >= Date.now())
    .sort((a, b) => a.starts.getTime() - b.starts.getTime())[0];
  if (!next) return 'No upcoming meetings loaded';
  const minutes = Math.max(0, Math.round((next.starts.getTime() - Date.now()) / 60000));
  if (minutes < 60) return `Next meeting in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Next meeting in ${hours} hr`;
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
  if (!event) return 'No meeting found';
  const starts = eventStart(event);
  if (!starts) return 'Time unavailable';
  return starts.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function nextMeeting(events: CalendarEvent[]) {
  return events
    .map((event) => ({ event, starts: eventStart(event) }))
    .filter((item): item is { event: CalendarEvent; starts: Date } => item.starts instanceof Date && item.starts.getTime() >= Date.now())
    .sort((a, b) => a.starts.getTime() - b.starts.getTime())[0]?.event;
}

export function DashboardPage() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, []);

  const priorityEmails = emails.filter(isLikelyImportantSender).slice(0, 4);
  const pendingTasks = tasks.filter((task) => task.status !== 'completed');
  const overdue = overdueTasks(tasks);
  const dueToday = pendingTasks.filter((task) => {
    if (!task.due_date) return false;
    const due = new Date(task.due_date);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  });
  const upcomingTasks = pendingTasks.filter((task) => !overdue.some((item) => item.id === task.id) && !dueToday.some((item) => item.id === task.id));
  const meeting = nextMeeting(events);
  const briefingItems = [
    `${priorityEmails.length} priority unread email${priorityEmails.length === 1 ? '' : 's'}`,
    meeting ? nextMeetingText(events) : 'No upcoming meeting loaded',
    `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`
  ];

  async function quickComplete(task: Task) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'completed' } : item));
    await completeTask(task.id);
    loadDashboard();
  }

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title="Dashboard"
        subtitle="A focused command center for mail, meetings, tasks, and AI suggestions."
        action={<Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDashboard}>Refresh</Button>}
      />
      {errors.length > 0 && <Alert sx={{ mb: 2 }} severity="warning">{errors.join(' ')}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}><StatCard label="Unread Emails" value={emails.length} helper={`${emails.slice(0, 3).filter((email) => !/no-reply|newsletter|promotions/i.test(email.sender)).length} from likely important senders`} icon={<MailIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} md={4}><StatCard label="Upcoming Meetings" value={events.length} helper={nextMeetingText(events)} icon={<EventIcon fontSize="small" />} accent="#0f9f8f" /></Grid>
        <Grid item xs={12} md={4}><StatCard label="Pending Tasks" value={tasks.filter((task) => task.status !== 'completed').length} helper={`${overdueTasks(tasks).length} overdue tasks`} icon={<CheckCircleIcon fontSize="small" />} accent="#b86b00" /></Grid>
        <Grid item xs={12} lg={7}>
          <Card className="premium-panel" sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.dark', display: 'grid', placeItems: 'center' }}>
                    <BoltIcon />
                  </Box>
                  <Box>
                    <Typography variant="h6">Today Briefing</Typography>
                    <Typography color="text.secondary" variant="body2">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Typography>
                  </Box>
                </Stack>
                <Grid container spacing={1.25}>
                  {briefingItems.map((item) => (
                    <Grid item xs={12} sm={4} key={item}>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fff', p: 1.5, height: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 850 }}>{item}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity={overdue.length ? 'warning' : 'info'}>
                  {overdue.length ? `Start with ${overdue[0]?.title}. It is overdue.` : priorityEmails.length ? `Start with ${priorityEmails[0]?.subject}.` : 'You are clear for now. Use AI Suggestions to plan ahead.'}
                </Alert>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card className="premium-panel" sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ScheduleIcon color="primary" />
                  <Box>
                    <Typography variant="h6">Next Meeting</Typography>
                    <Typography color="text.secondary" variant="body2">{formatMeetingTime(meeting)}</Typography>
                  </Box>
                </Stack>
                {meeting ? (
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fff', p: 1.5 }}>
                    <Typography sx={{ fontWeight: 850 }}>{meeting.summary ?? meeting.subject ?? '(No title)'}</Typography>
                    {meeting.accountEmail && <Typography variant="body2" color="text.secondary">{meeting.accountEmail}</Typography>}
                    {meeting.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{meeting.description}</Typography>}
                  </Box>
                ) : (
                  <Alert severity="info">No upcoming meeting found.</Alert>
                )}
                <Button href="/calendar" variant="contained" endIcon={<OpenInNewIcon />}>Open Calendar</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card className="premium-panel" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} spacing={1}>
                <Box>
                  <Typography variant="h6">Priority Inbox</Typography>
                  <Typography color="text.secondary" variant="body2">Unread messages from likely real senders.</Typography>
                </Box>
                <Chip icon={<MailIcon />} label={`${priorityEmails.length} priority`} color="primary" variant="outlined" />
              </Stack>
              <Stack divider={<Divider flexItem />} spacing={0}>
                {priorityEmails.map((email) => (
                  <Box key={email.id} sx={{ py: 1.25, px: 0.75, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Typography sx={{ fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{email.subject}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{email.sender}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      <Button size="small" href={`/emails/${encodeURIComponent(email.id)}`}>Open</Button>
                      <Button size="small" href={`/assistant?prompt=${encodeURIComponent(`Summarize this email: ${email.subject}`)}`}>Summarize</Button>
                      <Button size="small" href={`/tasks?title=${encodeURIComponent(email.subject)}`}>Create task</Button>
                    </Stack>
                  </Box>
                ))}
                {priorityEmails.length === 0 && <Alert severity="info">No priority unread emails found.</Alert>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card className="premium-panel" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} spacing={1}>
                <Box>
                  <Typography variant="h6">Task Focus</Typography>
                  <Typography color="text.secondary" variant="body2">{overdue.length} overdue, {dueToday.length} due today</Typography>
                </Box>
                <Chip icon={<TaskAltIcon />} label={`${pendingTasks.length} pending`} color="warning" variant="outlined" />
              </Stack>
              <Stack spacing={1.25}>
                {[...overdue, ...dueToday, ...upcomingTasks].slice(0, 5).map((task) => (
                  <Box key={task.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fff', p: 1 }}>
                    <Checkbox size="small" onChange={() => quickComplete(task)} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDueDate(task.due_date)}</Typography>
                    </Box>
                  </Box>
                ))}
                {pendingTasks.length === 0 && <Alert severity="success">No pending tasks.</Alert>}
                <Button href="/tasks" variant="outlined" endIcon={<ArrowForwardIcon />}>Open Tasks</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card className="premium-panel">
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
                <Box>
                  <Typography variant="h6">AI Suggestions</Typography>
                  <Typography color="text.secondary" variant="body2">Fast prompts based on your workspace.</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                  {[
                    'Summarize my unread emails',
                    'Plan my day from meetings and tasks',
                    'Create tasks from priority emails',
                    'Find a free calendar slot today'
                  ].map((prompt) => (
                    <Button key={prompt} href={`/assistant?prompt=${encodeURIComponent(prompt)}`} variant="outlined" startIcon={<AutoAwesomeIcon />}>
                      {prompt}
                    </Button>
                  ))}
                  <Button href="/calendar" variant="contained" startIcon={<AddIcon />}>Create Meeting</Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
