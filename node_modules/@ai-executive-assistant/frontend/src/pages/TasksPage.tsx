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

  return (
    <>
      <PageHeader title="Tasks" subtitle="Create, complete, and sync work with Google Tasks." />
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
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
                      <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25 }}>
                  <Checkbox checked={task.status === 'completed'} onChange={async () => { await completeTask(task.id); load(); }} />
                  <Stack sx={{ flex: 1 }}>
                    <Typography sx={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none', fontWeight: 700 }}>{task.title}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary">{task.due_date ?? 'No due date'}</Typography>
                      <Chip size="small" label="pending" color="warning" variant="outlined" />
                    </Stack>
                  </Stack>
                  <IconButton aria-label="Delete task" onClick={async () => { await removeTask(task.id); load(); }}>
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
                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, opacity: 0.72 }}>
                          <Checkbox checked onChange={async () => { await completeTask(task.id); load(); }} />
                          <Stack sx={{ flex: 1 }}>
                            <Typography sx={{ textDecoration: 'line-through', fontWeight: 700 }}>{task.title}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" color="text.secondary">{task.due_date ?? 'No due date'}</Typography>
                              <Chip size="small" label="completed" color="success" variant="outlined" />
                            </Stack>
                          </Stack>
                          <IconButton aria-label="Delete task" onClick={async () => { await removeTask(task.id); load(); }}>
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
