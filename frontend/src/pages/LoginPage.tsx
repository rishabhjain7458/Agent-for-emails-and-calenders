import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: { xs: 3, sm: 5 }, maxWidth: 460, width: '100%', border: '1px solid', borderColor: 'divider', boxShadow: '0 24px 60px rgba(18, 26, 43, 0.12)' }}>
        <Stack spacing={3.5}>
          <Box>
            <Chip size="small" label="Google workspace ready" color="primary" variant="outlined" sx={{ mb: 2 }} />
            <Typography variant="h4" sx={{ mb: 1 }}>AI Executive Assistant</Typography>
            <Typography color="text.secondary">Centralize email, calendar, tasks, and AI workflows in one focused workspace.</Typography>
          </Box>
          <Button size="large" variant="contained" startIcon={<GoogleIcon />} onClick={() => login('google')}>
            Continue with Google
          </Button>
          <Button size="large" variant="outlined" startIcon={<MailOutlineIcon />} onClick={() => login('microsoft')}>
            Continue with Outlook
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
