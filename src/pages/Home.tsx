import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useSearchParams } from 'react-router-dom';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import VideoCard from '../components/VideoCard';
import { VideoService, Video } from '../services/VideoService';
import { useSiteConfig } from '../context/SiteConfigContext';

const shuffleArray = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const Home: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHydratingVideos, setIsHydratingVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCancelMessage, setShowCancelMessage] = useState(false);
  const [onlineNow, setOnlineNow] = useState(0);
  const { videoListTitle } = useSiteConfig();

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);
        const videoIds = shuffleArray(await VideoService.getVideoIds());
        const idCards: Video[] = videoIds.map((id) => ({
          $id: id,
          title: id,
          description: '',
          price: 0,
          duration: '00:00',
          createdAt: new Date().toISOString(),
          views: 0,
          isPurchased: false,
        }));
        setVideos(idCards);
        setLoading(false);

        setIsHydratingVideos(true);
        const allVideos = await VideoService.getAllVideos();
        setVideos(shuffleArray(allVideos));
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError('Failed to load videos. Please try again later.');
      } finally {
        setIsHydratingVideos(false);
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  useEffect(() => {
    const paymentCanceled = searchParams.get('payment_canceled');
    if (paymentCanceled !== 'true') return;

    setShowCancelMessage(true);
    const timeout = setTimeout(() => {
      setShowCancelMessage(false);
      searchParams.delete('payment_canceled');
      setSearchParams(searchParams);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [searchParams, setSearchParams]);

  const filteredVideos = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return videos;
    return videos.filter(
      (video) =>
        video.title.toLowerCase().includes(normalized) ||
        video.description.toLowerCase().includes(normalized)
    );
  }, [videos, search]);

  useEffect(() => {
    setOnlineNow(40 + Math.floor(Math.random() * 80));
    const timer = setInterval(() => {
      setOnlineNow((prev) => Math.max(12, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? '#000000'
            : 'linear-gradient(180deg, rgba(250,250,252,1) 0%, rgba(255,255,255,1) 100%)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box
          sx={{
            mb: 3,
            border: '1px solid rgba(227, 27, 35, 0.6)',
            borderRadius: '20px',
            p: { xs: 1.5, md: 2.5 },
            background: 'linear-gradient(180deg, rgba(12,12,14,0.98) 0%, rgba(8,8,10,0.98) 100%)',
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.65)',
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: '#ff8e95', letterSpacing: 1, fontWeight: 700 }}
          >
            PREMIUM FOLDERS
          </Typography>
          <Typography
            variant="h4"
            sx={{
              color: '#e31b23',
              fontWeight: 900,
              lineHeight: 1.1,
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            {videoListTitle || 'Premium Collection'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#f3d8da', mb: 1.5 }}>
            VIP channels and groups with daily updates.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`● ${onlineNow} BUYING NOW`}
              sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
            />
            <Chip
              label="⚡ ONLINE"
              sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
            />
            <Chip
              label="👤 1,240+ SOLD"
              sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
            />
          </Box>
        </Box>

        {showCancelMessage && (
          <Alert severity="info" sx={{ mb: 3 }} onClose={() => setShowCancelMessage(false)}>
            Payment cancelled. No charges were made.
          </Alert>
        )}

        <Box
          id="videos-grid-section"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            mb: 3,
            mt: 2,
            gap: 2,
          }}
        >
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: '#ffe3e3' }}>
            {videoListTitle || 'Videos'}
          </Typography>
          {isHydratingVideos && (
            <Chip
              label="Updating full data..."
              sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
            />
          )}
          <TextField
            placeholder="Find folders, vip, premium..."
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{
              minWidth: { xs: '100%', md: 280 },
              '& .MuiOutlinedInput-root': {
                color: '#ffe6e6',
                borderRadius: '999px',
                backgroundColor: 'rgba(15,15,18,0.95)',
                '& fieldset': { borderColor: 'rgba(227,27,35,0.45)' },
                '&:hover fieldset': { borderColor: 'rgba(227,27,35,0.65)' },
                '&.Mui-focused fieldset': { borderColor: 'rgba(227,27,35,0.9)' },
              },
            }}
          />
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
            {filteredVideos.map((video) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={video.$id}>
                <VideoCard video={video} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default Home;
