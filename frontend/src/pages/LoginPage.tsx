import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper className="premium-panel" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 480, width: '100%', border: '1px solid', borderColor: 'divider', boxShadow: '0 26px 70px rgba(24, 35, 56, 0.14)' }}>
        <Stack spacing={3.5}>
          <Box>
            <Chip size="small" icon={<AutoAwesomeIcon />} label="Workspace ready" color="primary" variant="outlined" sx={{ mb: 2 }} />
            <Typography variant="h4" sx={{ mb: 1, lineHeight: 1.08 }}>AI Executive Assistant</Typography>
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
