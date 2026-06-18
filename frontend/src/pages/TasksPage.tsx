import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { PageHeader } from '../components/PageHeader';
import { completeTask, createTask, getTasks, removeTask } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { Task } from '../types';

export function TasksPage() {
  const [searchParams] = useSearchParams();
  const { activeSpaceId, activeSpace, isCombined } = useSpace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const pendingTasks = tasks.filter((task) => task.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.status === 'completed');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setTasks(await getTasks(isCombined ? 'all' : activeSpaceId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tasks could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const nextTitle = searchParams.get('title');
    if (nextTitle) setTitle(nextTitle);
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [activeSpaceId, isCombined]);

  async function submit() {
    if (!title.trim()) return;
    await createTask({ title, dueDate, accountId: isCombined ? 'primary' : activeSpaceId });
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

  function handleTaskTouchEnd(task: Task, x: number) {
    if (touchStartX === null) return;
    const deltaX = x - touchStartX;
    setTouchStartX(null);
    if (Math.abs(deltaX) < 80) return;
    if (deltaX > 0 && task.status !== 'completed') markComplete(task);
    if (deltaX < 0) deleteOne(task);
  }

  return (
    <>
      <PageHeader title="Tasks" subtitle="Create, complete, and sync work with your task list." />
      {error && <Alert sx={{ mb: 2 }} severity="warning">{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Card className="premium-panel">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="h6">Create Task</Typography>
                    <Typography color="text.secondary" variant="body2">Capture a next action with an optional due date.</Typography>
                  </Box>
                  <Chip size="small" icon={<PlaylistAddCheckIcon />} label="New" color="primary" variant="outlined" />
                </Stack>
                <TextField select label="Create in space" value={isCombined ? 'primary' : activeSpaceId}>
                  <MenuItem value={isCombined ? 'primary' : activeSpaceId}>
                    {isCombined ? 'Primary account' : activeSpace?.email ?? 'Selected space'}
                  </MenuItem>
                </TextField>
                <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
                <TextField label="Due Date" type="date" value={dueDate} InputLabelProps={{ shrink: true }} onChange={(event) => setDueDate(event.target.value)} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={submit}>Create Task</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card className="premium-panel">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1.5 }} spacing={1.25}>
                <Box>
                  <Typography variant="h6">Task List</Typography>
                  <Typography color="text.secondary" variant="body2">{loading ? 'Loading tasks...' : `${pendingTasks.length} pending, ${completedTasks.length} completed`}</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Chip label={isCombined ? 'Combined tasks' : activeSpace?.email ?? 'Selected space'} color="primary" variant="outlined" />
                  <CheckCircleIcon color="primary" />
                </Stack>
              </Stack>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 800 }}>Pending</Typography>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {pendingTasks.map((task) => (
                      <Box
                        key={task.id}
                        onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                        onTouchEnd={(event) => handleTaskTouchEnd(task, event.changedTouches[0]?.clientX ?? touchStartX ?? 0)}
                        sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 0.75, sm: 1.5 }, py: 1.25, px: 0.75, borderRadius: 2, transition: 'background 160ms ease, transform 160ms ease', '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(3px)' } } }}
                      >
                  <Checkbox disabled={busyTaskId === task.id} checked={task.status === 'completed'} onChange={() => markComplete(task)} sx={{ mt: -0.5 }} />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none', fontWeight: 700, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary">{task.due_date ?? 'No due date'}</Typography>
                      {task.account_email && <Chip size="small" label={task.account_email} variant="outlined" />}
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
                        <Box
                          key={task.id}
                          onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                          onTouchEnd={(event) => handleTaskTouchEnd(task, event.changedTouches[0]?.clientX ?? touchStartX ?? 0)}
                          sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 0.75, sm: 1.5 }, py: 1.25, px: 0.75, borderRadius: 2, opacity: 0.72, transition: 'background 160ms ease', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <Checkbox disabled checked sx={{ mt: -0.5 }} />
                          <Stack sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ textDecoration: 'line-through', fontWeight: 700, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" color="text.secondary">{task.due_date ?? 'No due date'}</Typography>
                              {task.account_email && <Chip size="small" label={task.account_email} variant="outlined" />}
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
