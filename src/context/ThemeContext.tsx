import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    // Check if user has a saved theme preference
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    if (savedTheme) {
      setMode(savedTheme);
    } else {
      // Set dark theme as default
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  useEffect(() => {
    // Save theme preference
    localStorage.setItem('theme', mode);
    
    // Apply theme class to body
    document.body.className = mode === 'dark' ? 'dark-theme' : 'light-theme';
  }, [mode]);

  const toggleTheme = () => {
    setMode(prevMode => (prevMode === 'dark' ? 'light' : 'dark'));
  };

  // Paleta: preto + vermelho (sem azul)
  const brandRed = '#e31b23';
  const brandRedDark = '#c9151d';

  // Create MUI theme based on mode, usando a paleta do checkout
  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: brandRed,
      },
      secondary: {
        main: brandRedDark,
      },
      background: {
        default: mode === 'dark' 
          ? '#000000' 
          : '#f7f7fb',
        paper: mode === 'dark' 
          ? '#0a0a0c' 
          : '#ffffff',
      },
      text: {
        primary: mode === 'dark' ? '#e8e8e8' : '#111111',
        secondary: mode === 'dark' ? '#b8b2be' : '#4b4b4b',
      },
      error: {
        main: '#d32f2f',
      },
    },
    typography: {
      fontFamily: '"Segoe UI", system-ui, -apple-system, "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 800,
        letterSpacing: '0.5px',
      },
      h2: {
        fontWeight: 700,
        letterSpacing: '0.3px',
      },
      h3: {
        fontWeight: 600,
      },
      h4: {
        fontWeight: 600,
      },
      button: {
        fontWeight: 600,
        textTransform: 'none',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            padding: '8px 20px',
            fontWeight: 600,
            textTransform: 'none',
            transition: 'all 0.25s ease',
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              background:
                `radial-gradient(circle at 0 0, rgba(227,27,35,0.25), transparent 55%), radial-gradient(circle at 100% 100%, rgba(227,27,35,0.22), transparent 55%)`,
              opacity: 0,
              transform: 'scale(0.9)',
              transition: 'opacity 0.25s ease, transform 0.25s ease',
              pointerEvents: 'none',
            },
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: mode === 'dark'
                ? '0 8px 20px rgba(15,23,42,0.7)'
                : '0 6px 16px rgba(15,23,42,0.2)',
            },
            '&:hover::after': {
              opacity: 1,
              transform: 'scale(1.02)',
            },
            '&:active': {
              transform: 'translateY(0)',
              boxShadow: mode === 'dark'
                ? '0 4px 12px rgba(15,23,42,0.7)'
                : '0 3px 10px rgba(15,23,42,0.25)',
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${brandRed} 0%, ${brandRedDark} 100%)`,
            boxShadow: '0 10px 26px rgba(227,27,35,0.26)',
            '&:hover': {
              background: `linear-gradient(135deg, ${brandRed} 0%, ${brandRedDark} 100%)`,
              boxShadow: '0 14px 34px rgba(227,27,35,0.32)',
            },
            '&:active': {
              boxShadow: '0 8px 22px rgba(227,27,35,0.26)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#ffffff',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
            border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: mode === 'dark' ? '0 6px 18px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.08)',
            '&:hover': {
              transform: 'translateY(-2px)',
              zIndex: 1,
              borderColor: mode === 'dark' ? 'rgba(227,27,35,0.45)' : 'rgba(227,27,35,0.3)',
              boxShadow: mode === 'dark' ? '0 16px 36px rgba(227,27,35,0.25)' : '0 10px 24px rgba(227,27,35,0.18)',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' 
              ? 'rgba(15,15,26,0.95)' 
              : '#ffffff',
            color: mode === 'dark' ? '#ffffff' : '#111111',
            boxShadow: mode === 'dark' ? '0 2px 14px rgba(0, 0, 0, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(10px)',
            borderBottom: mode === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }
          }
        }
      },
    },
  });

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}; 