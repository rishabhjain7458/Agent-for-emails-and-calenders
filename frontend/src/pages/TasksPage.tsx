import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PageHeader } from '../components/PageHeader';
import { completeTask, createTask, getTasks, removeTask } from '../api/endpoints';
import type { Task } from '../types';

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const pendingTasks = tasks.filter((task) => task.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.status === 'completed');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setTasks(await getTasks());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tasks could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    if (!title.trim()) return;
    await createTask({ title, dueDate });
    setTitle('');
    setDueDate('');
    load();
  }

  async function markComplete(task: Task) {
    setBusyTaskId(task.id);
    setError('');
    const previous = tasks;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'completed' } : item));
    try {
      await completeTask(task.id);
      await load();
    } catch (caught) {
      setTasks(previous);
      setError(caught instanceof Error ? caught.message : 'Task could not be marked completed.');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function deleteOne(task: Task) {
    setBusyTaskId(task.id);
    setError('');
    const previous = tasks;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await removeTask(task.id);
      await load();
    } catch (caught) {
      setTasks(previous);
      setError(caught instanceof Error ? caught.message : 'Task could not be deleted.');
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <>
      <PageHeader title="Tasks" subtitle="Create, complete, and sync work with your task list." />
      {error && <Alert sx={{ mb: 2 }} severity="warning">{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Create Task</Typography>
                <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
                <TextField label="Due Date" type="date" value={dueDate} InputLabelProps={{ shrink: true }} onChange={(event) => setDueDate(event.target.value)} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={submit}>Create Task</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }} spacing={1}>
                <Box>
                  <Typography variant="h6">Task List</Typography>
                  <Typography color="text.secondary" variant="body2">{loading ? 'Loading tasks...' : `${pendingTasks.length} pending, ${completedTasks.length} completed`}</Typography>
                </Box>
                <CheckCircleIcon color="primary" />
              </Stack>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 800 }}>Pending</Typography>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {pendingTasks.map((task) => (
                      <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 0.75, sm: 1.5 }, py: 1.25, px: 0.75, borderRadius: 2, transition: 'background 160ms ease, transform 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(3px)' } } }}>
                  <Checkbox disabled={busyTaskId === task.id} checked={task.status === 'completed'} onChange={() => markComplete(task)} sx={{ mt: -0.5 }} />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none', fontWeight: 700, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary">{task.due_date ?? 'No due date'}</Typography>
                      <Chip size="small" label="pending" color="warning" variant="outlined" />
                    </Stack>
                  </Stack>
                  <IconButton disabled={busyTaskId === task.id} aria-label="Delete task" onClick={() => deleteOne(task)}>
                    <DeleteIcon />
                  </IconButton>
                      </Box>
                    ))}
                    {!loading && pendingTasks.length === 0 && <Alert severity="info">No pending tasks.</Alert>}
                  </Stack>
                </Box>

                {completedTasks.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 800 }}>Completed</Typography>
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {completedTasks.map((task) => (
                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 0.75, sm: 1.5 }, py: 1.25, px: 0.75, borderRadius: 2, opacity: 0.72, transition: 'background 160ms ease', '&:hover': { bgcolor: 'action.hover' } }}>
                          <Checkbox disabled checked sx={{ mt: -0.5 }} />
                          <Stack sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ textDecoration: 'line-through', fontWeight: 700, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" color="text.secondary">{task.due_date ?? 'No due date'}</Typography>
                              <Chip size="small" label="completed" color="success" variant="outlined" />
                            </Stack>
                          </Stack>
                          <IconButton disabled={busyTaskId === task.id} aria-label="Delete task" onClick={() => deleteOne(task)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
