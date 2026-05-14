import type { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useSiteConfig } from '../context/SiteConfigContext';

const Footer: FC = () => {
  const currentYear = new Date().getFullYear();
  const theme = useTheme();
  const { siteName, telegramUsername } = useSiteConfig();
  
  return (
    <Box 
      component="footer" 
      sx={{ 
        py: 2.5, 
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(180deg, rgba(12,12,14,0.96) 0%, rgba(7,7,9,0.99) 100%)'
          : 'linear-gradient(180deg, rgba(250,250,252,0.95) 0%, rgba(255,255,255,0.98) 100%)',
        borderTop: theme.palette.mode === 'dark'
          ? '1px solid rgba(227,27,35,0.22)'
          : '1px solid rgba(0,0,0,0.06)',
        color: theme.palette.mode === 'dark' ? '#eaeaec' : '#111',
        mt: 4,
      }}
    >
      <Box sx={{ px: 2, display: 'flex', justifyContent: 'center', textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.mode === 'dark' ? 'rgba(242,242,243,0.6)' : 'rgba(0,0,0,0.55)',
            letterSpacing: 0.2,
          }}
        >
          © {currentYear} {siteName} · Telegram: {telegramUsername ? `@${telegramUsername.replace('@', '')}` : 'Support'} · 18+ only · instant access
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
