import { FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import { VideoService } from '../services/VideoService';

interface VideoPreview {
  $id: string;
  title: string;
  thumbnailUrl?: string;
  duration?: string | number;
  price: number;
}

interface MultiVideoPreviewProps {
  videos: VideoPreview[];
  onVideoClick?: (videoId: string) => void;
  autoPlay?: boolean;
  showControls?: boolean;
}

const MultiVideoPreview: FC<MultiVideoPreviewProps> = ({ 
  videos, 
  onVideoClick,
  autoPlay = false,
  showControls = true 
}) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedThumbnails, setLoadedThumbnails] = useState<Set<string>>(new Set());

  // Auto-advance carousel if autoPlay is enabled
  useEffect(() => {
    if (autoPlay && videos.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % videos.length);
      }, 3000); // Change every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [autoPlay, videos.length]);

  // Load thumbnails
  useEffect(() => {
    const loadThumbnails = async () => {
      setIsLoading(true);
      for (const video of videos) {
        if (video.thumbnailUrl && !loadedThumbnails.has(video.$id)) {
          try {
            const img = new Image();
            img.onload = () => {
              setLoadedThumbnails(prev => new Set([...prev, video.$id]));
            };
            img.src = video.thumbnailUrl;
          } catch (error) {
            console.error('Error loading thumbnail:', error);
          }
        }
      }
      setIsLoading(false);
    };

    loadThumbnails();
  }, [videos, loadedThumbnails]);

  const handleVideoClick = async (video: VideoPreview) => {
    try {
      await VideoService.incrementViews(video.$id);
      if (onVideoClick) {
        onVideoClick(video.$id);
      } else {
        navigate(`/video/${video.$id}`);
      }
    } catch (error) {
      console.error('Error handling video click:', error);
      if (onVideoClick) {
        onVideoClick(video.$id);
      } else {
        navigate(`/video/${video.$id}`);
      }
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  };

  const formatDuration = (duration?: string | number) => {
    if (duration === undefined || duration === null) return '00:00';
    
    if (typeof duration === 'number') {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return String(duration);
  };

  if (videos.length === 0) {
    return (
      <Box sx={{ 
        width: '100%', 
        height: '200px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#020617',
        borderRadius: 1
      }}>
        <Typography color="text.secondary">No videos available</Typography>
      </Box>
    );
  }

  const currentVideo = videos[currentIndex];

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Main video display */}
      <Box sx={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        cursor: 'pointer'
      }}
      onClick={() => handleVideoClick(currentVideo)}
      >
        {/* Thumbnail or loading */}
        {isLoading || !loadedThumbnails.has(currentVideo.$id) ? (
          <Skeleton 
            variant="rectangular" 
            sx={{ 
              width: '100%', 
              height: '100%',
              bgcolor: '#020617'
            }} 
            animation="wave" 
          />
        ) : (
          <CardMedia
            component="img"
            image={currentVideo.thumbnailUrl}
            alt={currentVideo.title}
            sx={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: '#020617',
              filter: 'brightness(0.8)',
            }}
          />
        )}

        {/* Play overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(2,6,23,0.5)',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(15,23,42,0.85)',
            }
          }}
        >
          <Box
            sx={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,15,80,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              color: 'white',
              fontSize: '1.8rem',
              fontWeight: 900,
            }}
          >
            ▶
          </Box>
        </Box>

        {/* Video info overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(2,6,23,0.95))',
            color: 'white',
            p: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            {currentVideo.title}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentVideo.duration && (
              <Chip 
                label={formatDuration(currentVideo.duration)} 
                size="small" 
                sx={{ 
                  backgroundColor: 'rgba(2,6,23,0.9)',
                  color: 'white',
                  height: '20px',
                  fontSize: '0.7rem'
                }}
              />
            )}
            
            <Typography variant="body2" sx={{ color: 'white' }}>
              ${currentVideo.price.toFixed(2)}
            </Typography>
          </Box>
        </Box>

        {/* Video counter */}
        {videos.length > 1 && (
          <Chip 
            label={`${currentIndex + 1}/${videos.length}`} 
            size="small" 
            sx={{ 
              position: 'absolute', 
              top: 8, 
              right: 8, 
              backgroundColor: 'rgba(2,6,23,0.9)',
              color: 'white',
              fontWeight: 'bold',
              height: '24px',
            }}
          />
        )}
      </Box>

      {/* Navigation controls */}
      {showControls && videos.length > 1 && (
        <>
          <IconButton
            onClick={handlePrevious}
            sx={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.9)',
              }
            }}
          >
            ‹
          </IconButton>
          
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.9)',
              }
            }}
          >
            ›
          </IconButton>
        </>
      )}

      {/* Thumbnail strip (optional) */}
      {videos.length > 1 && (
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          mt: 1, 
          overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.3)', borderRadius: 2 }
        }}>
          {videos.map((video, index) => (
            <Box
              key={video.$id}
              onClick={() => setCurrentIndex(index)}
              sx={{
                minWidth: '60px',
                height: '40px',
                borderRadius: 1,
                overflow: 'hidden',
                cursor: 'pointer',
                border: currentIndex === index ? (theme => `2px solid ${theme.palette.primary.main}`) : '2px solid transparent',
                opacity: currentIndex === index ? 1 : 0.7,
                transition: 'all 0.3s ease',
                '&:hover': {
                  opacity: 1,
                }
              }}
            >
              <CardMedia
                component="img"
                image={video.thumbnailUrl}
                alt={video.title}
                sx={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default MultiVideoPreview;
