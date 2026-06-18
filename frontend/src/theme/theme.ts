import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2557d6', dark: '#163d9e', light: '#eaf0ff' },
    secondary: { main: '#0f9f8f', dark: '#087c72', light: '#def8f3' },
    success: { main: '#137a50' },
    warning: { main: '#aa6400' },
    error: { main: '#c53636' },
    background: {
      default: '#f6f8fc',
      paper: '#ffffff'
    },
    text: {
      primary: '#111827',
      secondary: '#5f6b7f'
    },
    divider: '#e0e7f1',
    action: {
      hover: '#eef4ff',
      selected: '#eaf0ff'
    }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 850, letterSpacing: 0 },
    h5: { fontWeight: 850, letterSpacing: 0 },
    h6: { fontWeight: 800, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'linear-gradient(180deg, #fbfcff 0%, #f6f8fc 46%, #f3f6fb 100%)',
          color: '#111827'
        }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 38,
          transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' }
        },
        contained: { boxShadow: '0 8px 18px rgba(37, 87, 214, 0.18)' },
        outlined: {
          backgroundColor: '#ffffff',
          '&:hover': { backgroundColor: '#f8fbff' }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid rgba(214, 223, 236, 0.92)',
          boxShadow: '0 14px 34px rgba(24, 35, 56, 0.06)',
          transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
          '&:hover': {
            borderColor: '#cdd9ea',
            boxShadow: '0 18px 42px rgba(24, 35, 56, 0.085)'
          }
        }
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 18,
          '&:last-child': { paddingBottom: 18 }
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
            '& fieldset': {
              borderColor: '#d8e1ee'
            },
            '&:hover fieldset': {
              borderColor: '#b9c7db'
            },
            '&.Mui-focused': {
              boxShadow: '0 0 0 4px rgba(37, 87, 214, 0.1)'
            }
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 700 }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease',
          '&:hover': { transform: 'translateX(2px)', backgroundColor: '#f2f6ff' },
          '&.Mui-selected': {
            color: '#163d9e',
            '& .MuiListItemIcon-root': { color: '#2557d6' }
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12
        }
      }
    }
  }
});
