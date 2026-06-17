import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddIcon from '@mui/icons-material/Add';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PageHeader } from '../components/PageHeader';
import { createEvent, deleteEvent, getConnectedAccounts, getEvents } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import type { CalendarEvent, ConnectedAccount } from '../types';

const initialForm = { title: '', date: '', startTime: '', endTime: '', timezone: 'Asia/Kolkata', description: '', attendees: '' };

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

const accountPalette = ['#2557d6', '#0f9f8f', '#b86b00', '#8b5cf6', '#e0476b', '#168053'];

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toTimeInput(value: Date) {
  return value.toTimeString().slice(0, 5);
}

function eventAccountKey(event: CalendarEvent) {
  return event.accountId ?? event.accountEmail ?? 'primary';
}

function eventUrlFromDescription(description?: string) {
  return description?.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.;]+$/, '');
}

export function CalendarPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [createAccountId, setCreateAccountId] = useState('primary');
  const [form, setForm] = useState(initialForm);
  const [conflict, setConflict] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setEvents(await getEvents(selectedAccountId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getConnectedAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    load();
  }, [selectedAccountId]);

  const accountOptions = [
    { id: 'primary', email: user?.email ?? 'Primary account', provider: user?.provider ?? 'google', label: `${user?.email ?? 'Primary account'} (primary)` },
    ...accounts.map((account) => ({ id: account.id, email: account.email, provider: account.provider, label: account.email }))
  ];

  const accountColors = useMemo(() => {
    const entries = accountOptions.map((account, index) => [account.id, accountPalette[index % accountPalette.length]] as const);
    const byEmail = accountOptions.map((account, index) => [account.email, accountPalette[index % accountPalette.length]] as const);
    return new Map([...entries, ...byEmail]);
  }, [accountOptions]);

  function colorForEvent(event: CalendarEvent) {
    if (event.start?.date && !event.start?.dateTime) return '#0f9f8f';
    return accountColors.get(eventAccountKey(event)) ?? '#2557d6';
  }

  const calendarEvents = useMemo(() => events.map((event) => ({
    id: event.id,
    title: event.summary ?? event.subject ?? '(No title)',
    start: event.start?.dateTime ?? event.start?.date,
    end: event.end?.dateTime ?? event.end?.date,
    backgroundColor: colorForEvent(event),
    borderColor: colorForEvent(event),
    extendedProps: { description: event.description, accountEmail: event.accountEmail, providerEvent: event }
  })), [events, accountColors]);

  const agendaEvents = useMemo(() => events
    .map((event) => ({ event, starts: new Date(event.start?.dateTime ?? event.start?.date ?? '') }))
    .filter((item) => !Number.isNaN(item.starts.getTime()))
    .sort((a, b) => a.starts.getTime() - b.starts.getTime())
    .slice(0, isMobile ? 12 : 10), [events, isMobile]);

  const groupedAgenda = useMemo(() => ({
    today: agendaEvents.filter(({ starts }) => starts.toDateString() === new Date().toDateString()),
    tomorrow: agendaEvents.filter(({ starts }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return starts.toDateString() === tomorrow.toDateString();
    }),
    upcoming: agendaEvents.filter(({ starts }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return starts.toDateString() !== new Date().toDateString() && starts.toDateString() !== tomorrow.toDateString();
    })
  }), [agendaEvents]);

  function formatEventDate(value?: string) {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined });
  }

  function updateForm(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function prefillFromSlot(start: Date, end?: Date | null) {
    const fallbackEnd = end ?? new Date(start.getTime() + 30 * 60 * 1000);
    setForm((current) => ({
      ...current,
      date: toDateInput(start),
      startTime: toTimeInput(start),
      endTime: toTimeInput(fallbackEnd)
    }));
    setNotice('Time selected. Add a title and create the event.');
  }

  function validateForm() {
    if (!form.title.trim()) return 'Add a meeting title.';
    if (!form.date) return 'Choose a meeting date.';
    if (!form.startTime || !form.endTime) return 'Choose both start and end time.';
    if (form.endTime <= form.startTime) return 'End time must be after start time.';
    const attendees = form.attendees.split(',').map((item) => item.trim()).filter(Boolean);
    const invalidAttendee = attendees.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidAttendee) return `Attendees must be email addresses. "${invalidAttendee}" is not valid.`;
    return '';
  }

  async function submit(force = false) {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    setError('');
    setNotice('');
    try {
      const payload = { ...form, attendees: form.attendees.split(',').map((item) => item.trim()).filter(Boolean), force, accountId: createAccountId };
      const result: any = await createEvent(payload);
      if (result.requiresConfirmation) {
        setConflict(result);
        return;
      }
      setForm(initialForm);
      setConflict(null);
      setNotice('Event created.');
      await load();
    } catch (caught: any) {
      setError(caught?.response?.data?.error?.message ?? caught?.message ?? 'Event could not be created.');
    } finally {
      setCreating(false);
    }
  }

  async function removeSelectedEvent() {
    if (!selectedEvent) return;
    await deleteEvent(selectedEvent.id);
    setSelectedEvent(null);
    setNotice('Event deleted.');
    await load();
  }

  function copyEventDetails() {
    if (!selectedEvent) return;
    const text = [
      selectedEvent.summary ?? selectedEvent.subject ?? '(No title)',
      `Starts: ${formatEventDate(selectedEvent.start?.dateTime ?? selectedEvent.start?.date)}`,
      `Ends: ${formatEventDate(selectedEvent.end?.dateTime ?? selectedEvent.end?.date)}`,
      selectedEvent.description ?? ''
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(text);
    setNotice('Event details copied.');
  }

  function AgendaGroup({ title, items }: { title: string; items: typeof agendaEvents }) {
    return (
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 850 }}>{title}</Typography>
        <Stack spacing={1}>
          {items.map(({ event, starts }) => (
            <Box key={event.id} onClick={() => setSelectedEvent(event)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: '#fff', cursor: 'pointer', borderLeft: `4px solid ${colorForEvent(event)}`, transition: 'transform 160ms ease, background 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(2px)' } } }}>
              <Typography variant="body2" sx={{ fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.summary ?? event.subject ?? '(No title)'}</Typography>
              <Typography variant="caption" color="text.secondary">{starts.toLocaleString([], { dateStyle: title === 'Today' || title === 'Tomorrow' ? undefined : 'medium', timeStyle: event.start?.dateTime ? 'short' : undefined })}</Typography>
              {event.accountEmail && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{event.accountEmail}</Typography>}
            </Box>
          ))}
          {items.length === 0 && <Alert severity="info">No {title.toLowerCase()} events.</Alert>}
        </Stack>
      </Box>
    );
  }

  const selectedEventLink = eventUrlFromDescription(selectedEvent?.description);

  return (
    <>
      <PageHeader title="Calendar" subtitle="Create meetings, inspect your agenda, and use open slots to schedule faster." action={<Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>} />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      {error && <Alert sx={{ mb: 2 }} severity="warning">{error}</Alert>}
      {loading && <Alert sx={{ mb: 2 }} severity="info">Loading calendar events...</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <Card className="premium-panel">
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Create Event</Typography>
                  <Typography color="text.secondary" variant="body2">Tap a calendar slot to prefill time, then finish the meeting details here.</Typography>
                </Box>
                <Chip size="small" icon={<AccessTimeIcon />} label={form.timezone.replace('_', ' ')} color="primary" variant="outlined" />
              </Stack>
              <Grid container spacing={1.5} alignItems="flex-start">
                <Grid item xs={12} md={3}>
                  <TextField fullWidth select label="Create in account" value={createAccountId} onChange={(event) => setCreateAccountId(event.target.value)}>
                    {accountOptions.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Meeting title" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Project discussion" />
                </Grid>
                <Grid item xs={12} sm={4} md={2}>
                  <TextField fullWidth label="Date" type="date" value={form.date} InputLabelProps={{ shrink: true }} onChange={(event) => updateForm('date', event.target.value)} />
                </Grid>
                <Grid item xs={6} sm={4} md={1.5}>
                  <TextField fullWidth label="Start" type="time" value={form.startTime} InputLabelProps={{ shrink: true }} onChange={(event) => updateForm('startTime', event.target.value)} />
                </Grid>
                <Grid item xs={6} sm={4} md={1.5}>
                  <TextField fullWidth label="End" type="time" value={form.endTime} InputLabelProps={{ shrink: true }} onChange={(event) => updateForm('endTime', event.target.value)} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth select label="Country / timezone" value={form.timezone} onChange={(event) => updateForm('timezone', event.target.value)} helperText="Meeting timezone">
                    {timezoneOptions.map((timezone) => (
                      <MenuItem key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Attendees" value={form.attendees} onChange={(event) => updateForm('attendees', event.target.value)} placeholder="name@example.com, teammate@example.com" helperText="Comma-separated emails" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Description" value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Agenda, Meet link, or context" multiline minRows={1} maxRows={3} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button fullWidth disabled={creating} variant="contained" startIcon={<AddIcon />} onClick={() => submit(false)} sx={{ minHeight: 56 }}>
                    {creating ? 'Creating...' : 'Create Event'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card className="premium-panel">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.25} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Schedule</Typography>
                  <Typography color="text.secondary" variant="body2">{events.length} events loaded</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <TextField select size="small" label="View account" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} sx={{ minWidth: 220 }}>
                    <MenuItem value="all">All accounts</MenuItem>
                    {accountOptions.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Chip icon={<EventAvailableIcon />} label="Live calendar" color="primary" variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
                </Stack>
              </Stack>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
                firstDay={1}
                headerToolbar={isMobile ? { left: 'prev,next', center: 'title', right: 'today' } : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
                events={calendarEvents}
                height="auto"
                expandRows
                nowIndicator
                selectable
                selectMirror
                allDaySlot
                allDayText="All day"
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                scrollTime="08:00:00"
                slotDuration="00:30:00"
                slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
                dayHeaderFormat={{ weekday: isMobile ? 'short' : 'short', day: 'numeric', month: 'short' }}
                eventDisplay="block"
                eventMinHeight={34}
                eventShortHeight={34}
                slotEventOverlap={false}
                dayMaxEvents
                select={(info) => prefillFromSlot(info.start, info.end)}
                dateClick={(info) => prefillFromSlot(info.date)}
                eventClick={(info) => {
                  const matchingEvent = events.find((event) => event.id === info.event.id);
                  if (matchingEvent) setSelectedEvent(matchingEvent);
                }}
                eventContent={(info) => (
                  <Box sx={{ px: 0.75, py: 0.4, overflow: 'hidden' }}>
                    {info.timeText && <Typography component="div" variant="caption" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{info.timeText}</Typography>}
                    <Typography component="div" variant="caption" sx={{ fontWeight: 750, lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{info.event.title}</Typography>
                    {info.event.extendedProps.accountEmail && <Typography component="div" variant="caption" sx={{ lineHeight: 1.2, opacity: 0.9 }}>{info.event.extendedProps.accountEmail}</Typography>}
                  </Box>
                )}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                {accountOptions.map((account) => (
                  <Chip
                    key={account.id}
                    size="small"
                    label={account.label}
                    variant="outlined"
                    sx={{
                      borderColor: accountColors.get(account.id),
                      '&::before': {
                        bgcolor: accountColors.get(account.id),
                        borderRadius: '50%',
                        content: '""',
                        height: 8,
                        ml: 1,
                        width: 8
                      }
                    }}
                  />
                ))}
                <Chip size="small" label="All-day / birthdays" variant="outlined" sx={{ borderColor: '#0f9f8f' }} />
              </Stack>
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Agenda</Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <AgendaGroup title="Today" items={groupedAgenda.today} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <AgendaGroup title="Tomorrow" items={groupedAgenda.tomorrow} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <AgendaGroup title="Upcoming" items={groupedAgenda.upcoming} />
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Dialog open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ bgcolor: selectedEvent ? colorForEvent(selectedEvent) : 'primary.main', borderRadius: 1.5, height: 34, width: 6 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{selectedEvent?.summary ?? selectedEvent?.subject ?? '(No title)'}</Typography>
              {selectedEvent?.accountEmail && <Typography variant="body2" color="text.secondary">{selectedEvent.accountEmail}</Typography>}
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            {selectedEventLink && (
              <Button fullWidth variant="contained" href={selectedEventLink} target="_blank" endIcon={<OpenInNewIcon />}>
                Join / Open Link
              </Button>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Starts</Typography>
              <Typography>{formatEventDate(selectedEvent?.start?.dateTime ?? selectedEvent?.start?.date)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Ends</Typography>
              <Typography>{formatEventDate(selectedEvent?.end?.dateTime ?? selectedEvent?.end?.date)}</Typography>
            </Box>
            {selectedEvent?.description && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Description</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedEvent.description}</Typography>
              </Box>
            )}
            {selectedEvent?.accountEmail && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Account</Typography>
                <Typography>{selectedEvent.accountEmail}</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<ContentCopyIcon />} onClick={copyEventDetails}>Copy</Button>
          <Button color="error" startIcon={<DeleteIcon />} onClick={removeSelectedEvent}>Delete</Button>
          <Button onClick={() => setSelectedEvent(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(conflict)} onClose={() => setConflict(null)}>
        <DialogTitle>Calendar conflict detected</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>This event overlaps existing calendar events.</Typography>
          {conflict?.suggestions?.map((slot: any) => (
            <Typography key={slot.start} color="text.secondary">{slot.start} to {slot.end}</Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflict(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => submit(true)}>Create Anyway</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
