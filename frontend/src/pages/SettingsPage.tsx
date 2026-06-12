import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import { PageHeader } from '../components/PageHeader';
import { getSettings, updateSettings } from '../api/endpoints';

export function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [ignorePromotions, setIgnorePromotions] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getSettings().then((settings) => {
      setGeminiApiKey(settings.gemini_api_key ?? '');
      setTimezone(settings.timezone ?? 'UTC');
      setIgnorePromotions(settings.email_preferences?.ignorePromotions ?? true);
    });
  }, []);

  async function save() {
    await updateSettings({
      geminiApiKey,
      timezone,
      emailPreferences: {
        priorityCategories: ['security', 'financial', 'work', 'meetings'],
        ignorePromotions
      }
    });
    setNotice('Settings saved.');
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure tenant-aware assistant preferences." />
      {notice && <Alert sx={{ mb: 2 }} severity="success">{notice}</Alert>}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">AI & Workspace</Typography>
                    <Typography color="text.secondary" variant="body2">Personalize assistant behavior and tenant defaults.</Typography>
                  </Box>
                  <Chip icon={<SettingsIcon />} label="Tenant scoped" variant="outlined" />
                </Stack>
                <TextField label="Gemini API Key" type="password" value={geminiApiKey} onChange={(event) => setGeminiApiKey(event.target.value)} />
                <TextField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                <FormControlLabel control={<Switch checked={ignorePromotions} onChange={(event) => setIgnorePromotions(event.target.checked)} />} label="Ignore promotions in AI email summaries" />
                <Button variant="contained" startIcon={<SaveIcon />} onClick={save}>Save Settings</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
