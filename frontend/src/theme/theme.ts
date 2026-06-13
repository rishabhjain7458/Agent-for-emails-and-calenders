import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2454c6', dark: '#173b91', light: '#e8eefc' },
    secondary: { main: '#0f9f8f', dark: '#087c72', light: '#dff7f3' },
    success: { main: '#168053' },
    warning: { main: '#b86b00' },
    error: { main: '#c93535' },
    background: {
      default: '#f4f6fa',
      paper: '#ffffff'
    },
    text: {
      primary: '#121a2b',
      secondary: '#647085'
    },
    divider: '#dfe5ef',
    action: {
      hover: '#eef3fb',
      selected: '#e8eefc'
    }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 800, letterSpacing: 0 },
    h5: { fontWeight: 800, letterSpacing: 0 },
    h6: { fontWeight: 750, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(circle at top left, rgba(36, 84, 198, 0.08), transparent 34rem), linear-gradient(180deg, #f8faff 0%, #f4f6fa 46%)'
        }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 40,
          transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' }
        },
        contained: { boxShadow: '0 8px 18px rgba(36, 84, 198, 0.18)' }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid #e4e9f2',
          boxShadow: '0 16px 36px rgba(18, 26, 43, 0.07)',
          transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
          '&:hover': {
            borderColor: '#d4ddec',
            boxShadow: '0 20px 44px rgba(18, 26, 43, 0.1)'
          }
        }
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          '&:last-child': { paddingBottom: 20 }
        }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#ffffff',
            transition: 'box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
            '&.Mui-focused': {
              boxShadow: '0 0 0 4px rgba(36, 84, 198, 0.1)'
            }
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 650 }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease',
          '&:hover': { transform: 'translateX(2px)' },
          '&.Mui-selected': {
            color: '#173b91',
            '& .MuiListItemIcon-root': { color: '#2454c6' }
          }
        }
      }
    }
  }
});
