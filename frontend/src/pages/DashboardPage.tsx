import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MailIcon from '@mui/icons-material/Mail';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { getEmails, getEvents, getTasks } from '../api/endpoints';
import type { CalendarEvent, EmailMessage, Task } from '../types';

type ActivityItem = { id: string; label: string };

export function DashboardPage() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const results = await Promise.allSettled([getEmails('in:inbox is:unread'), getEvents(), getTasks()]);
      if (!active) return;

      const nextErrors: string[] = [];
      const [mailResult, calendarResult, taskResult] = results;

      if (mailResult.status === 'fulfilled') setEmails(mailResult.value);
      else nextErrors.push('Unread emails could not be loaded.');

      if (calendarResult.status === 'fulfilled') setEvents(calendarResult.value);
      else nextErrors.push('Upcoming meetings could not be loaded.');

      if (taskResult.status === 'fulfilled') setTasks(taskResult.value);
      else nextErrors.push('Pending tasks could not be loaded.');

      setErrors(nextErrors);
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageHeader eyebrow="Today" title="Dashboard" subtitle="A focused view of mail, meetings, and tasks that need attention." />
      {errors.length > 0 && <Alert sx={{ mb: 2 }} severity="warning">{errors.join(' ')}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}><StatCard label="Unread Emails" value={emails.length} helper="Priority inbox scan" icon={<MailIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} md={4}><StatCard label="Upcoming Meetings" value={events.length} helper="Primary calendar" icon={<EventIcon fontSize="small" />} accent="#0f9f8f" /></Grid>
        <Grid item xs={12} md={4}><StatCard label="Pending Tasks" value={tasks.filter((task) => task.status !== 'completed').length} helper="Tenant workspace tasks" icon={<CheckCircleIcon fontSize="small" />} accent="#b86b00" /></Grid>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Recent Activity</Typography>
                  <Typography color="text.secondary" variant="body2">Latest items pulled from your inbox and task list.</Typography>
                </Box>
                <Chip size="small" label={`${emails.length + tasks.length} total`} />
              </Stack>
              <Stack divider={<Divider flexItem />} spacing={0}>
                {([
                  ...emails.slice(0, 3).map((email) => ({ id: email.id, label: email.subject })),
                  ...tasks.slice(0, 3).map((task) => ({ id: task.id, label: task.title }))
                ] satisfies ActivityItem[]).map((item) => (
                  <Box key={item.id} sx={{ py: 1.3, px: 0.75, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2, transition: 'background 160ms ease, transform 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(3px)' } } }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flex: '0 0 auto', boxShadow: '0 0 0 4px rgba(36, 84, 198, 0.12)' }} />
                    <Typography color="text.secondary" noWrap>{item.label}</Typography>
                  </Box>
                ))}
                {emails.length + tasks.length === 0 && (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No recent activity yet.</Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Quick Actions</Typography>
              <Stack spacing={1.5}>
                <Button href="/calendar" variant="contained" startIcon={<AddIcon />} endIcon={<ArrowForwardIcon />} sx={{ justifyContent: 'space-between' }}>Create Meeting</Button>
                <Button href="/tasks" variant="outlined" startIcon={<AddIcon />} endIcon={<ArrowForwardIcon />} sx={{ justifyContent: 'space-between' }}>Create Task</Button>
                <Button href="/emails" variant="outlined" startIcon={<MailIcon />} endIcon={<ArrowForwardIcon />} sx={{ justifyContent: 'space-between' }}>Draft Reply</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
