import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmailIcon from '@mui/icons-material/Email';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 260;
const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Emails', path: '/emails', icon: <EmailIcon /> },
  { label: 'Calendar', path: '/calendar', icon: <EventIcon /> },
  { label: 'Tasks', path: '/tasks', icon: <CheckCircleIcon /> },
  { label: 'AI Assistant', path: '/assistant', icon: <SmartToyIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> }
];

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
      <Toolbar sx={{ px: { xs: 2, sm: 3 }, minHeight: { xs: 64, sm: 76 }, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 900 }}>
            AI
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.1 }}>Executive</Typography>
            <Typography variant="body2" color="text.secondary">Assistant</Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={() => setOpen(false)} aria-label="Close navigation">
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ p: 1.5, flex: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={location.pathname.startsWith(item.path)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 46,
              '& .MuiListItemIcon-root': { minWidth: 40, color: 'text.secondary' },
              '&.Mui-selected': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`
              }
            }}
            onClick={() => setOpen(false)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#f8faff' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main' }}>{user?.name?.[0] ?? 'U'}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 750 }} noWrap>{user?.name ?? 'Workspace user'}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{user?.role ?? 'Connected'}</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: alpha('#ffffff', 0.9),
          backdropFilter: 'blur(14px)'
        }}
      >
        <Toolbar sx={{ gap: { xs: 0.75, sm: 1.5 }, minHeight: { xs: 64, sm: 72 }, px: { xs: 1.25, sm: 2 } }}>
          {isMobile && (
            <IconButton onClick={() => setOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <TextField
            size="small"
            placeholder={isMobile ? 'Search' : 'Search emails, meetings, tasks'}
            sx={{
              maxWidth: { xs: 'none', md: 560 },
              flex: 1,
              minWidth: 0,
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
              '& .MuiInputBase-input': { px: { xs: 0.5, sm: 1.75 } }
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          {!isMobile && <Chip size="small" label={`${user?.provider === 'microsoft' ? 'Outlook' : 'Google'} connected`} color="secondary" variant="outlined" />}
          <Avatar sx={{ width: { xs: 32, sm: 36 }, height: { xs: 32, sm: 36 }, bgcolor: 'primary.main' }}>{user?.name?.[0] ?? 'U'}</Avatar>
          {!isMobile && <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>{user?.email}</Typography>}
          <Tooltip title="Logout">
            <IconButton onClick={logout} aria-label="Logout">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flex: 1, ml: { md: `${drawerWidth}px` }, pt: { xs: 9, sm: 10, md: 11 }, px: { xs: 1.5, sm: 2.5, md: 4 }, pb: { xs: 3, md: 5 }, minWidth: 0 }}>
        <Box sx={{ maxWidth: 1320, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
