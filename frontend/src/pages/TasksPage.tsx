import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { PageHeader } from '../components/PageHeader';
import { completeTask, createTask, getConnectedAccounts, getTasks, removeTask } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import type { ConnectedAccount, Task } from '../types';

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [createAccountId, setCreateAccountId] = useState('primary');
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
      setTasks(await getTasks(selectedAccountId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tasks could not be loaded.');
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

  async function submit() {
    if (!title.trim()) return;
    await createTask({ title, dueDate, accountId: createAccountId });
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
                <TextField select label="Create in account" value={createAccountId} onChange={(event) => setCreateAccountId(event.target.value)}>
                  {accountOptions.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.label}
                    </MenuItem>
                  ))}
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
                  <TextField select size="small" label="View account" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} sx={{ minWidth: { sm: 220 } }}>
                    <MenuItem value="all">All accounts</MenuItem>
                    {accountOptions.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <CheckCircleIcon color="primary" />
                </Stack>
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
                        <Box key={task.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 0.75, sm: 1.5 }, py: 1.25, px: 0.75, borderRadius: 2, opacity: 0.72, transition: 'background 160ms ease', '&:hover': { bgcolor: 'action.hover' } }}>
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
