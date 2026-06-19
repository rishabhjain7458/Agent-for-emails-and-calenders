import { createTheme } from '@mui/material/styles';

export type AppThemeMode = 'light' | 'dark';

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === 'dark';
  return createTheme({
  palette: {
    mode,
    primary: { main: '#2557d6', dark: '#163d9e', light: isDark ? '#7ca0ff' : '#eaf0ff' },
    secondary: { main: '#0f9f8f', dark: '#087c72', light: isDark ? '#5eead4' : '#def8f3' },
    success: { main: '#137a50' },
    warning: { main: isDark ? '#f4b860' : '#aa6400' },
    error: { main: isDark ? '#ff7b7b' : '#c53636' },
    background: {
      default: isDark ? '#0b1220' : '#f6f8fc',
      paper: isDark ? '#111a2c' : '#ffffff'
    },
    text: {
      primary: isDark ? '#edf3ff' : '#111827',
      secondary: isDark ? '#a8b4c8' : '#5f6b7f'
    },
    divider: isDark ? '#26344c' : '#e0e7f1',
    action: {
      hover: isDark ? '#17243a' : '#eef4ff',
      selected: isDark ? '#1d3154' : '#eaf0ff'
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
          colorScheme: mode,
          backgroundImage:
            isDark
              ? 'linear-gradient(180deg, #0f172a 0%, #0b1220 48%, #08101d 100%)'
              : 'linear-gradient(180deg, #fbfcff 0%, #f6f8fc 46%, #f3f6fb 100%)',
          color: isDark ? '#edf3ff' : '#111827'
        }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 40,
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease',
          '&:hover': { transform: 'translateY(-2px)' },
          '&:active': { transform: 'translateY(0)' }
        },
        contained: {
          backgroundImage: 'linear-gradient(135deg, #2557d6 0%, #1d4ed8 54%, #0f9f8f 140%)',
          boxShadow: isDark ? '0 12px 28px rgba(37, 87, 214, 0.28)' : '0 10px 24px rgba(37, 87, 214, 0.2)'
        },
        outlined: {
          backgroundColor: isDark ? '#111a2c' : '#ffffff',
          borderColor: isDark ? '#33445f' : '#d8e1ee',
          '&:hover': { backgroundColor: isDark ? '#17243a' : '#f8fbff' }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: isDark ? '1px solid rgba(58, 75, 105, 0.92)' : '1px solid rgba(214, 223, 236, 0.92)',
          boxShadow: isDark ? '0 14px 34px rgba(0, 0, 0, 0.24)' : '0 14px 34px rgba(24, 35, 56, 0.06)',
          position: 'relative',
          transition: 'transform 190ms ease, box-shadow 190ms ease, border-color 190ms ease, background-color 190ms ease',
          '&:hover': {
            borderColor: isDark ? '#3b4c68' : '#cdd9ea',
            boxShadow: isDark ? '0 20px 48px rgba(0, 0, 0, 0.34)' : '0 20px 48px rgba(24, 35, 56, 0.095)',
            transform: 'translateY(-2px)'
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
            backgroundColor: isDark ? '#111a2c' : '#ffffff',
            transition: 'box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
            '& fieldset': {
              borderColor: isDark ? '#33445f' : '#d8e1ee'
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#4d6284' : '#b9c7db'
            },
            '&.Mui-focused': {
              boxShadow: isDark ? '0 0 0 4px rgba(124, 160, 255, 0.13)' : '0 0 0 4px rgba(37, 87, 214, 0.1)'
            }
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 750,
          transition: 'transform 160ms ease, background-color 160ms ease, border-color 160ms ease',
          '&:hover': { transform: 'translateY(-1px)' }
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease',
          '&:hover': { transform: 'translateX(2px)', backgroundColor: isDark ? '#17243a' : '#f2f6ff' },
          '&.Mui-selected': {
            color: isDark ? '#9bb7ff' : '#163d9e',
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
}

export const theme = createAppTheme('light');
