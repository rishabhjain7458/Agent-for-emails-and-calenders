import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { PageHeader } from '../components/PageHeader';
import { createEvent, getEvents } from '../api/endpoints';
import type { CalendarEvent } from '../types';

const initialForm = { title: '', date: '', startTime: '', endTime: '', timezone: 'Asia/Kolkata', description: '', attendees: '' };

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [form, setForm] = useState(initialForm);
  const [conflict, setConflict] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [notice, setNotice] = useState('');

  async function load() {
    setEvents(await getEvents());
  }

  useEffect(() => {
    load();
  }, []);

  const calendarEvents = useMemo(() => events.map((event) => ({
    id: event.id,
    title: event.summary,
    start: event.start?.dateTime ?? event.start?.date,
    end: event.end?.dateTime ?? event.end?.date,
    extendedProps: { description: event.description }
  })), [events]);

  function formatEventDate(value?: string) {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined });
  }

  async function submit(force = false) {
    const payload = { ...form, attendees: form.attendees.split(',').map((item) => item.trim()).filter(Boolean), force };
    const result: any = await createEvent(payload);
    if (result.requiresConfirmation) {
      setConflict(result);
      return;
    }
    setForm(initialForm);
    setConflict(null);
    setNotice('Event created.');
    load();
  }

  return (
    <>
      <PageHeader title="Calendar" subtitle="Create meetings with conflict detection and availability suggestions." />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Create Event</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Add meeting details and let the assistant check for conflicts.</Typography>
              <Stack spacing={2}>
                {Object.entries(form).map(([key, value]) => (
                  <TextField
                    key={key}
                    label={key === 'attendees' ? 'Attendees' : key}
                    type={key === 'date' ? 'date' : key.toLowerCase().includes('time') ? 'time' : 'text'}
                    value={value}
                    InputLabelProps={key === 'date' || key.toLowerCase().includes('time') ? { shrink: true } : undefined}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  />
                ))}
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => submit(false)}>Create Event</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Schedule</Typography>
                  <Typography color="text.secondary" variant="body2">{events.length} events on your primary calendar</Typography>
                </Box>
                <Chip icon={<EventAvailableIcon />} label="Live calendar" color="primary" variant="outlined" />
              </Stack>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                events={calendarEvents}
                height="auto"
                expandRows
                nowIndicator
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
