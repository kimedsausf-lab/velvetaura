import { useContext } from 'react';
import type { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const Header: FC = () => {
  const { mode } = useContext(ThemeContext);
  const { siteName } = useSiteConfig();

  return (
    <AppBar 
      position="static"
      sx={{
        background: mode === 'dark' 
          ? 'linear-gradient(180deg, rgba(3,9,37,0.98) 0%, rgba(2,6,23,0.96) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        color: mode === 'dark' ? '#fff' : '#111',
        boxShadow: mode === 'dark' 
          ? '0 2px 16px rgba(0,0,0,0.4)' 
          : '0 2px 16px rgba(0,0,0,0.06)',
        borderBottom: mode === 'dark' 
          ? '1px solid rgba(255,255,255,0.05)' 
          : '1px solid rgba(0,0,0,0.06)'
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: '96px', sm: '112px' },
          justifyContent: 'center',
        }}
      >
        {/* Site Logo/Name only */}
        <Box
          component={RouterLink}
          to="/"
          sx={{ 
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              background: 'transparent',
              borderRadius: '10px',
              px: { xs: 2, sm: 3 },
              py: { xs: 1, sm: 1.2 },
              mr: 0,
              border: mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.5px',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: { xs: '1.8rem', sm: '2.6rem' },
                color: mode === 'dark' ? 'white' : '#111',
              }}
            >
              {siteName.split(' ')[0]}
              <Box 
                component="span" 
                sx={{ 
                  color: mode === 'dark' ? 'white' : '#111',
                  fontWeight: 400,
                  ml: 0.5
                }}
              >
                {siteName.split(' ').slice(1).join(' ')}
              </Box>
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
