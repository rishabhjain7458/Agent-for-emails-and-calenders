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
import { PageHeader } from '../components/PageHeader';
import { createEvent, getConnectedAccounts, getEvents } from '../api/endpoints';
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

  async function load() {
    setEvents(await getEvents(selectedAccountId));
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

  const calendarEvents = useMemo(() => events.map((event) => ({
    id: event.id,
    title: event.summary ?? event.subject ?? '(No title)',
    start: event.start?.dateTime ?? event.start?.date,
    end: event.end?.dateTime ?? event.end?.date,
    extendedProps: { description: event.description, accountEmail: event.accountEmail }
  })), [events]);

  function formatEventDate(value?: string) {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined });
  }

  function updateForm(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
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

  return (
    <>
      <PageHeader title="Calendar" subtitle="Create meetings with conflict detection and availability suggestions." />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      {error && <Alert sx={{ mb: 2 }} severity="warning">{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={3.6}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Create Event</Typography>
                  <Typography color="text.secondary" variant="body2">Add meeting details and attendees.</Typography>
                </Box>
                <Chip size="small" label="New" color="primary" variant="outlined" />
              </Stack>
              <Stack spacing={2}>
                <TextField select label="Create in account" value={createAccountId} onChange={(event) => setCreateAccountId(event.target.value)}>
                  {accountOptions.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Meeting title" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Project discussion" />
                <TextField label="Date" type="date" value={form.date} InputLabelProps={{ shrink: true }} onChange={(event) => updateForm('date', event.target.value)} />
                <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={2}>
                  <TextField fullWidth label="Start time" type="time" value={form.startTime} InputLabelProps={{ shrink: true }} onChange={(event) => updateForm('startTime', event.target.value)} />
                  <TextField fullWidth label="End time" type="time" value={form.endTime} InputLabelProps={{ shrink: true }} onChange={(event) => updateForm('endTime', event.target.value)} />
                </Stack>
                <TextField select label="Country / timezone" value={form.timezone} onChange={(event) => updateForm('timezone', event.target.value)} helperText="Choose the country/timezone for this meeting.">
                  {timezoneOptions.map((timezone) => (
                    <MenuItem key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Description" value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Agenda or context" multiline minRows={3} />
                <TextField label="Attendees" value={form.attendees} onChange={(event) => updateForm('attendees', event.target.value)} placeholder="name@example.com, teammate@example.com" helperText="Use comma-separated email addresses." />
                <Button disabled={creating} variant="contained" startIcon={<AddIcon />} onClick={() => submit(false)}>
                  {creating ? 'Creating...' : 'Create Event'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={8.4}>
          <Card>
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
                allDaySlot={false}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotDuration="00:30:00"
                slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
                dayHeaderFormat={{ weekday: isMobile ? 'short' : 'short', day: 'numeric', month: 'short' }}
                eventDisplay="block"
                eventMinHeight={34}
                eventShortHeight={34}
                slotEventOverlap={false}
                dayMaxEvents
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Dialog open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedEvent?.summary}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
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
