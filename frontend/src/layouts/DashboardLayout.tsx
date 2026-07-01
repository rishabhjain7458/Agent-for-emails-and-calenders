import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
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
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeModeContext';

const drawerWidth = 276;
const collapsedDrawerWidth = 78;
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') !== 'false');
  const [sidebarHover, setSidebarHover] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const drawerExpanded = isMobile || !collapsed || sidebarHover;
  const layoutDrawerWidth = isMobile ? drawerWidth : collapsed ? collapsedDrawerWidth : drawerWidth;
  const paperDrawerWidth = isMobile ? drawerWidth : drawerExpanded ? drawerWidth : collapsedDrawerWidth;

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', overflowX: 'hidden' }}>
      <Toolbar sx={{ px: drawerExpanded ? { xs: 2, sm: 3 } : 1.25, minHeight: { xs: 64, sm: 76 }, justifyContent: drawerExpanded ? 'space-between' : 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: drawerExpanded ? 1.5 : 0 }}>
          <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 900, boxShadow: '0 12px 26px rgba(37, 87, 214, 0.28)', flex: '0 0 auto' }}>
            AI
          </Box>
          <Box sx={{ display: drawerExpanded ? 'block' : 'none', minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.1 }}>Executive</Typography>
            <Typography variant="body2" color="text.secondary">Assistant</Typography>
          </Box>
        </Box>
        {isMobile ? (
          <IconButton onClick={() => setOpen(false)} aria-label="Close navigation">
            <CloseIcon />
          </IconButton>
        ) : drawerExpanded && (
          <Tooltip title={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'}>
            <IconButton onClick={toggleCollapsed} aria-label={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'}>
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(224, 231, 241, 0.75)' }} />
      <List sx={{ p: 1.5, flex: 1 }}>
        {navItems.map((item) => {
          const selected = location.pathname.startsWith(item.path);
          const navButton = (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              sx={{
                borderRadius: 2,
                justifyContent: drawerExpanded ? 'flex-start' : 'center',
                mb: 0.65,
                minHeight: 48,
                px: drawerExpanded ? 1.35 : 1,
                position: 'relative',
                '& .MuiListItemIcon-root': { color: selected ? 'primary.main' : 'text.secondary', justifyContent: 'center', minWidth: drawerExpanded ? 40 : 0 },
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.11),
                  boxShadow: drawerExpanded
                    ? `inset 3px 0 0 ${theme.palette.primary.main}, 0 8px 18px ${alpha(theme.palette.primary.main, 0.08)}`
                    : `0 8px 18px ${alpha(theme.palette.primary.main, 0.1)}`
                },
                '&.Mui-selected::after': drawerExpanded ? undefined : {
                  bgcolor: 'primary.main',
                  borderRadius: 999,
                  bottom: 6,
                  content: '""',
                  height: 4,
                  left: '50%',
                  position: 'absolute',
                  transform: 'translateX(-50%)',
                  width: 18
                }
              }}
              onClick={() => {
                setOpen(false);
                window.requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                });
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              {drawerExpanded && <ListItemText primary={item.label} />}
            </ListItemButton>
          );

          return drawerExpanded ? navButton : (
            <Tooltip key={item.path} title={item.label} placement="right">
              {navButton}
            </Tooltip>
          );
        })}
      </List>
      <Box sx={{ p: drawerExpanded ? 2 : 1.25 }}>
        <Box sx={{ p: drawerExpanded ? 1.5 : 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', boxShadow: `inset 0 1px 0 ${alpha(theme.palette.background.paper, 0.8)}`, display: 'grid', placeItems: drawerExpanded ? 'stretch' : 'center', minHeight: drawerExpanded ? 'auto' : 48 }}>
          <Stack direction="row" spacing={drawerExpanded ? 1.25 : 0} alignItems="center">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main' }}>{user?.name?.[0] ?? 'U'}</Avatar>
            <Box sx={{ minWidth: 0, display: drawerExpanded ? 'block' : 'none' }}>
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
          bgcolor: alpha(theme.palette.background.paper, 0.82),
          backdropFilter: 'blur(18px)'
        }}
      >
        <Toolbar sx={{ gap: { xs: 0.75, sm: 1.35 }, minHeight: { xs: 58, sm: 62 }, px: { xs: 1.25, sm: 2.25 } }}>
          {isMobile && (
            <IconButton onClick={() => setOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 950, lineHeight: 1.05 }} noWrap>
              AI Executive Assistant
            </Typography>
            {!isMobile && (
              <Typography variant="caption" color="text.secondary" noWrap>
                Email, calendar, tasks, and AI in one workspace
              </Typography>
            )}
          </Box>
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
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
        onMouseEnter={() => {
          if (!isMobile && collapsed) setSidebarHover(true);
        }}
        onMouseLeave={() => {
          if (!isMobile) setSidebarHover(false);
        }}
        sx={{
          flexShrink: 0,
          width: layoutDrawerWidth,
          transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
          '& .MuiDrawer-paper': {
            width: paperDrawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            boxShadow: isMobile ? '0 24px 70px rgba(17, 24, 39, 0.22)' : drawerExpanded && collapsed ? '12px 0 34px rgba(17, 24, 39, 0.1)' : 'none',
            overflowX: 'hidden',
            transition: theme.transitions.create(['width', 'box-shadow'], { duration: theme.transitions.duration.shorter })
          }
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flex: 1, pt: { xs: 7, sm: 7.5, md: 8 }, px: { xs: 1.25, sm: 2.5, md: 3.5, xl: 5 }, pb: { xs: 3, md: 5 }, minWidth: 0, transition: theme.transitions.create('padding', { duration: theme.transitions.duration.shorter }) }}>
        <Box className="page-shell" sx={{ maxWidth: 1480, mx: 'auto', width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
