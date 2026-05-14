import { FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { Chip, CircularProgress, Button, Dialog, DialogTitle, DialogContent, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { VideoService } from '../services/VideoService';
import { useSiteConfig } from '../context/SiteConfigContext';
import { StripeService } from '../services/StripeService';
import { isPayJsrCheckoutAvailable } from '../utils/payjsrAvailability';
import MultiVideoPreview from './MultiVideoPreview';

const PREVIEW_CHANGE_EVENT = 'video-card-preview-change';
let previewLoadInFlightForVideoId: string | null = null;
let activePreviewVideoId: string | null = null;

interface VideoCardProps {
  video: {
    $id: string;
    title: string;
    description: string;
    price: number;
    thumbnailUrl?: string;
    thumbnailFileId?: string;
    thumbnail_id?: string;
    isPurchased?: boolean;
    duration?: string | number;
    views?: number;
    createdAt?: string;
    created_at?: string;
    // Support for multiple videos in preview
    relatedVideos?: Array<{
      $id: string;
      title: string;
      thumbnailUrl?: string;
      duration?: string | number;
      price: number;
    }>;
    is_free?: boolean;
    product_link?: string;
  };
  onSelectVideo?: (videoId: string) => void;
}

const VideoCard: FC<VideoCardProps> = ({ video, onSelectVideo }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);
  const { telegramUsername, stripePublishableKey, stripeSecretKey, cryptoWallets, whoApiKey, paypalClientId, loading: configLoading } = useSiteConfig();
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCryptoWallet, setSelectedCryptoWallet] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = useState<string | null>(video.thumbnailUrl || null);
  
  const handleCardClick = async () => {
    try {
      // Increment view count
      await VideoService.incrementViews(video.$id);
      if (onSelectVideo) onSelectVideo(video.$id);
    } catch (error) {
      console.error('Error handling video card click:', error);
      if (onSelectVideo) onSelectVideo(video.$id);
    }
  };

  // Format the duration nicely
  const formatDuration = (duration?: string | number) => {
    if (duration === undefined || duration === null) return '00:00';
    
    // If duration is a number (seconds), convert to string format
    if (typeof duration === 'number') {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      return `${minutes}min ${seconds}s`;
    }
    
    // If duration is already a string, check format
    if (typeof duration === 'string') {
      try {
        // Check if duration is in format MM:SS or HH:MM:SS
        const parts = duration.split(':');
        if (parts.length === 2) {
          return `${parts[0]}min ${parts[1]}s`;
        } else if (parts.length === 3) {
          return `${parts[0]}h ${parts[1]}m ${parts[2]}s`;
        }
      } catch (error) {
        console.error('Error formatting duration:', error);
        // Return the original string if split fails
        return duration;
      }
    }
    
    // Return as is if we can't parse it
    return String(duration);
  };

  // Format view count with K, M, etc.
  const formatViews = (views?: number) => {
    if (views === undefined) return '0 views';
    if (views < 1000) return `${views} views`;
    if (views < 1000000) return `${(views / 1000).toFixed(1)}K views`;
    return `${(views / 1000000).toFixed(1)}M views`;
  };

  // Format date to relative time
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Ajuste para lidar com formato created_at ou createdAt
  const createdAtField = video.createdAt || video.created_at;

  // Keep thumbnail in sync when provided directly by API.
  useEffect(() => {
    if (video.thumbnailUrl) {
      setResolvedThumbnailUrl(video.thumbnailUrl);
      setIsThumbnailLoading(true);
      setThumbnailError(false);
      return;
    }

    const thumbnailId = video.thumbnailFileId || video.thumbnail_id;
    if (!thumbnailId) {
      setResolvedThumbnailUrl(null);
      setIsThumbnailLoading(false);
      return;
    }

    let cancelled = false;
    setIsThumbnailLoading(true);
    setThumbnailError(false);

    void VideoService.getThumbnailUrlById(thumbnailId)
      .then((url) => {
        if (cancelled) return;
        if (url) {
          setResolvedThumbnailUrl(url);
        } else {
          setResolvedThumbnailUrl(null);
          setIsThumbnailLoading(false);
          setThumbnailError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedThumbnailUrl(null);
        setIsThumbnailLoading(false);
        setThumbnailError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [video.thumbnailUrl, video.thumbnailFileId, video.thumbnail_id]);

  useEffect(() => {
    const handlePreviewChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ videoId: string | null }>;
      if (customEvent.detail?.videoId !== video.$id) {
        setIsPreviewPlaying(false);
      }
    };

    window.addEventListener(PREVIEW_CHANGE_EVENT, handlePreviewChange);
    return () => window.removeEventListener(PREVIEW_CHANGE_EVENT, handlePreviewChange);
  }, [video.$id]);

  const handleThumbnailLoad = () => {
    setIsThumbnailLoading(false);
  };

  const handleThumbnailError = () => {
    setIsThumbnailLoading(false);
    setThumbnailError(true);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      if (activePreviewVideoId === video.$id) {
        activePreviewVideoId = null;
        window.dispatchEvent(new CustomEvent(PREVIEW_CHANGE_EVENT, { detail: { videoId: null } }));
      }
      return;
    }

    const openPreview = async () => {
      if (previewVideoUrl) {
        activePreviewVideoId = video.$id;
        window.dispatchEvent(new CustomEvent(PREVIEW_CHANGE_EVENT, { detail: { videoId: video.$id } }));
        setIsPreviewPlaying(true);
        return;
      }

      if (previewLoadInFlightForVideoId && previewLoadInFlightForVideoId !== video.$id) {
        return;
      }

      try {
        previewLoadInFlightForVideoId = video.$id;
        setIsPreviewLoading(true);
        const url = await VideoService.getVideoFileUrl(video.$id);
        if (!url) return;
        setPreviewVideoUrl(url);
        activePreviewVideoId = video.$id;
        window.dispatchEvent(new CustomEvent(PREVIEW_CHANGE_EVENT, { detail: { videoId: video.$id } }));
        setIsPreviewPlaying(true);
      } catch (error) {
        console.error('Failed to load preview video URL:', error);
      } finally {
        if (previewLoadInFlightForVideoId === video.$id) {
          previewLoadInFlightForVideoId = null;
        }
        setIsPreviewLoading(false);
      }
    };

    void openPreview();
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetailsModal(true);
  };

  const handleTelegramClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Format date for "Added" field
    const formatAddedDate = (date: Date) => {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      return `${Math.ceil(diffDays / 30)} months ago`;
    };
    
    const msg = `🎬 **${video.title}**

💰 **Price:** $${video.price.toFixed(2)}
⏱️ **Duration:** ${formatDuration(video.duration)}
👀 **Views:** ${formatViews(video.views)}
📅 **Added:** ${formatAddedDate(new Date(video.createdAt || video.created_at || Date.now()))}

📝 **Description:**
${video.description || 'No description available'}

Please let me know how to proceed with payment.`;
    
    const encoded = encodeURIComponent(msg);
    const base = telegramUsername ? `https://t.me/${telegramUsername.replace('@', '')}` : 'https://t.me/share/url';
    const url = telegramUsername ? `${base}?text=${encoded}` : `${base}?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Create Telegram href for the button
  const telegramHref = (() => {
    if (!telegramUsername) return 'https://t.me/share/url';
    
    // Format date for "Added" field
    const formatAddedDate = (date: Date) => {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      return `${Math.ceil(diffDays / 30)} months ago`;
    };
    
    const msg = `🎬 **${video.title}**

💰 **Price:** $${video.price.toFixed(2)}
⏱️ **Duration:** ${formatDuration(video.duration)}
👀 **Views:** ${formatViews(video.views)}
📅 **Added:** ${formatAddedDate(new Date(video.createdAt || video.created_at || Date.now()))}

📝 **Description:**
${video.description || 'No description available'}

Please let me know how to proceed with payment.`;
    
    const encoded = encodeURIComponent(msg);
    return `https://t.me/${telegramUsername.replace('@', '')}?text=${encoded}`;
  })();

  const handleStripePay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPaymentModal(true);
  };

  const handleStripePayment = async () => {
    try {
      setIsStripeLoading(true);
      await StripeService.initStripe(stripePublishableKey);
      const productName = 'Video Access';
      const successUrl = `${window.location.origin}/#/payment-success?video_id=${video.$id}&payment_method=stripe`;
      const cancelUrl = 'https://www.google.com/';
      const checkout = await StripeService.createCheckoutSession(
        video.price,
        'usd',
        productName,
        successUrl,
        cancelUrl
      );
      await StripeService.redirectToCheckout(checkout.checkoutUrl);
    } catch (err) {
      console.error('Stripe payment error:', err);
    } finally {
      setIsStripeLoading(false);
      setShowPaymentModal(false);
    }
  };

  const handleWhoPayment = async () => {
    if (!whoApiKey) return;
    
    try {
      setIsStripeLoading(true);
      
      // Importar o WhoService dinamicamente
      const { WhoService } = await import('../services/WhoService');
      
      // Initialize WhoService with API key
      WhoService.initWho(whoApiKey);
      
      const productName = 'Video Access';
      const successUrl = `${window.location.origin}/#/payment-success?video_id=${video.$id}&session_id={CHECKOUT_SESSION_ID}&payment_method=who`;
      const cancelUrl = `${window.location.origin}/#/video/${video.$id}?payment_canceled=true`;
      
      const checkoutUrl = await WhoService.createCheckoutSession(
        video.price,
        'usd',
        productName,
        successUrl,
        cancelUrl
      );
      
      await WhoService.redirectToCheckout(checkoutUrl);
    } catch (err) {
      console.error('Whop payment error:', err);
      alert('Failed to initialize payment. Please try again.');
    } finally {
      setIsStripeLoading(false);
      setShowPaymentModal(false);
    }
  };

  const handlePayPalPayment = () => {
    if (!paypalClientId) return;
    
    // Prevenir múltiplas chamadas simultâneas
    if (isStripeLoading) {
      return;
    }
    
    try {
      setIsStripeLoading(true);
      
      const productNames = [
        "Personal Development Ebook",
        "Financial Freedom Ebook",
        "Digital Marketing Guide",
        "Health & Wellness Ebook",
        "Productivity Masterclass",
        "Mindfulness & Meditation Guide",
        "Entrepreneurship Blueprint"
      ];
      const randomProductName = productNames[Math.floor(Math.random() * productNames.length)];
      
      const successUrl = `${window.location.origin}/#/payment-success?video_id=${video.$id}&payment_method=paypal`;
      const cancelUrl = 'https://www.google.com/';
      
      const CHECKOUT_BASE = import.meta.env.VITE_CHECKOUT_URL || (import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || ''));
      const maskedUrl = `${CHECKOUT_BASE}/api/paypal-checkout?` + new URLSearchParams({
        amount: video.price.toFixed(2),
        currency: 'USD',
        video_id: video.$id || '',
        success_url: successUrl,
        cancel_url: cancelUrl,
        product_name: randomProductName,
        display_title: video.title,
      }).toString();
      
      // Abrir o checkout sempre na mesma aba para evitar janelas duplicadas
      window.location.href = maskedUrl;
      
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Error processing PayPal payment:', error);
      alert('Failed to initialize PayPal payment. Please try again.');
    } finally {
      // Reset após um pequeno delay para permitir que a janela abra
      setTimeout(() => setIsStripeLoading(false), 500);
    }
  };

  const handleCryptoPayment = () => {
    if (!selectedCryptoWallet) return;
    
    const [cryptoType, walletAddress] = selectedCryptoWallet.split(':');
    
    if (!telegramUsername) return;
    
    const message = `₿ **Crypto Payment Request**

📹 **Video:** ${video.title}
💰 **Amount:** $${video.price.toFixed(2)}
🪙 **Cryptocurrency:** ${cryptoType.toUpperCase()}
💼 **My Wallet:** ${walletAddress}
📅 **Date:** ${new Date().toLocaleString()}

I'm sending the payment from my wallet. Please confirm the transaction and provide access to the content.`;
    
    const encoded = encodeURIComponent(message);
    const telegramUrl = `https://t.me/${telegramUsername.replace('@', '')}?text=${encoded}`;
    
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    setShowPaymentModal(false);
  };

  return (
    <>
      {/* Add CSS animation for pulse effect */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
          }
        `}
      </style>
      
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: theme => theme.palette.mode === 'dark'
            ? '0 18px 40px rgba(0,0,0,0.65)'
            : '0 8px 24px rgba(15,23,42,0.18)',
          cursor: 'pointer',
          background: theme => theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #0f0f11 0%, #09090b 100%)'
            : theme.palette.background.paper,
          border: theme => theme.palette.mode === 'dark' ? '1px solid rgba(227, 27, 35, 0.58)' : '1px solid rgba(0,0,0,0.06)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme =>
              theme.palette.mode === 'dark'
                ? '0 26px 62px rgba(227, 27, 35, 0.32)'
                : '0 16px 36px rgba(255,0,0,0.22)',
            borderColor: theme =>
              theme.palette.mode === 'dark'
                ? 'rgba(227, 27, 35, 0.8)'
                : 'rgba(255,70,70,0.35)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '10%',
            right: '10%',
            bottom: -4,
            height: 10,
            borderRadius: '999px',
            background:
              'radial-gradient(circle at 50% 0, rgba(227, 27, 35, 0.7), transparent 60%)',
            opacity: 0,
            filter: 'blur(6px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            transform: 'scaleX(0.8)',
            pointerEvents: 'none',
          },
          '&:hover::after': {
            opacity: 1,
            transform: 'scaleX(1)',
          },
        }}
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
        {/* Multi-video preview (from previewSources) or single thumbnail */}
        {isPreviewPlaying && previewVideoUrl ? (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#05000c',
              zIndex: 4,
            }}
          >
            <video
              controls
              autoPlay
              preload="metadata"
              src={previewVideoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#05000c' }}
              onClick={(e) => e.stopPropagation()}
            >
              Your browser does not support video playback.
            </video>
          </Box>
        ) : (video as any).previewSources && (video as any).previewSources.length > 0 ? (
          <Box sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}>
            <MultiVideoPreview
              videos={[(video as any).previewSources].flat().slice(0,3).map((src: any, idx: number) => ({
                $id: `${video.$id}::${src.id}`,
                title: video.title,
                thumbnailUrl: src.thumbnail_file_id ? undefined : video.thumbnailUrl,
                duration: video.duration,
                price: video.price
              }))}
              onVideoClick={(videoId) => navigate(`/video/${videoId}`)}
              autoPlay={isHovered}
              showControls={isHovered}
            />
          </Box>
        ) : (
          <>
            {/* Single thumbnail image */}
        {resolvedThumbnailUrl && !thumbnailError ? (
          <CardMedia
            component="img"
            loading="lazy"
            image={resolvedThumbnailUrl}
            alt={video.title}
            sx={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: theme => theme.palette.background.default,
            }}
            onLoad={handleThumbnailLoad}
            onError={handleThumbnailError}
          />
        ) : (
          <Skeleton 
            variant="rectangular" 
            sx={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: theme => theme.palette.mode === 'dark' ? '#020617' : '#f5f5f5',
            }} 
            animation="wave" 
          />
            )}
          </>
        )}

        {/* Center Play button overlay */}
        {!isPreviewPlaying && !isPreviewLoading && !thumbnailError && (
          <Box
            onClick={handlePlayClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handlePlayClick(e as any);
              }
            }}
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 4,
              cursor: 'pointer',
            }}
          >
            <Box
              sx={{
                width: 74,
                height: 74,
                borderRadius: '999px',
                backgroundColor: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(227,27,35,0.65)',
                boxShadow: '0 16px 40px rgba(227,27,35,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                transition: 'transform 0.15s ease, background-color 0.15s ease',
                '&:hover': {
                  transform: 'scale(1.04)',
                  backgroundColor: 'rgba(0,0,0,0.65)',
                },
              }}
            >
              <Box
                sx={{
                  width: 0,
                  height: 0,
                  borderTop: '14px solid transparent',
                  borderBottom: '14px solid transparent',
                  borderLeft: '22px solid #ffffff',
                  marginLeft: '4px',
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.55))',
                }}
              />
            </Box>
          </Box>
        )}

        {/* Loading indicator overlay */}
        {(isThumbnailLoading && !!resolvedThumbnailUrl) || isPreviewLoading ? (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3,
            }}
          >
            <CircularProgress 
              size={40} 
              thickness={4}
              sx={{ 
                color: theme => theme.palette.primary.main,
                mb: 1,
                animation: 'pulse 1.5s ease-in-out infinite'
              }} 
            />
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'white',
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '0.75rem'
              }}
            >
              {isPreviewLoading ? 'Loading preview...' : 'Loading...'}
            </Typography>
          </Box>
        ) : null}

        {/* Error state overlay */}
        {thumbnailError && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: theme => theme.palette.mode === 'dark' ? '#020617' : '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3,
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme => theme.palette.mode === 'dark' ? '#999' : '#666',
                textAlign: 'center',
                fontSize: '0.9rem'
              }}
            >
              Video Thumbnail
            </Typography>
          </Box>
        )}
        
        {/* Removed adult content indicator */}
        {/* FREE badge */}
        {video.is_free && (
          <Chip 
            label="FREE" 
            size="small" 
            sx={{ 
              position: 'absolute', 
              top: 8, 
              right: 64, 
              backgroundColor: '#27ae60', 
              color: 'white', 
              fontWeight: 'bold', 
              fontSize: '0.8rem', 
              height: '22px', 
              zIndex: 2,
            }}
          />
        )}
        
        {/* Hover overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: theme => theme.palette.mode === 'dark' 
              ? 'linear-gradient(to top, rgba(10,0,25,0.86) 0%, rgba(18,0,34,0.55) 54%, rgba(23,0,36,0.2) 100%)' 
              : 'linear-gradient(to top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 60%, rgba(255,255,255,0) 100%)',
            opacity: isHovered ? 1 : (theme => theme.palette.mode === 'dark' ? 0.4 : 0.6),
            transition: 'all 0.3s ease',
          }}
        />
        
        {/* Duration badge */}
        {video.duration && (
          <Chip 
            label={formatDuration(video.duration)} 
            size="small" 
            sx={{ 
              position: 'absolute', 
              bottom: 8, 
              right: 8, 
              backgroundColor: 'rgba(20,0,40,0.8)',
              color: 'white',
              fontWeight: 'bold',
              height: '24px',
              '& .MuiChip-label': {
                px: 1,
              }
            }}
          />
        )}
        
        {/* Price badge - Pink/Red style */}
        <Chip 
          label={`$${video.price.toFixed(2)}`} 
          size="medium" 
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            fontWeight: 'bold',
            fontSize: '0.9rem',
            height: '32px',
            background: 'linear-gradient(90deg, #ff2f77 0%, #e60057 100%)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            '& .MuiChip-label': {
              color: 'white',
              fontWeight: 'bold',
              px: 1.5
            }
          }}
        />
      </Box>
      
      <CardContent sx={{ flexGrow: 1, p: 1.5, pt: 1.25, background: 'linear-gradient(180deg, #13010d 0%, #09000a 100%)' }}>
        <Typography gutterBottom variant="h6" component="div" sx={{
          fontWeight: 'bold',
          fontSize: '1rem',
          lineHeight: 1.2,
          mb: 1,
          height: '2.4rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          color: '#f2f2f3',
        }}>
          {video.title}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#b8b2be' }}>
            <Typography variant="caption">
              {formatViews(video.views)}
            </Typography>
          </Box>
          
          {createdAtField && (
            <Typography variant="caption" sx={{ color: '#b8b2be' }}>
              {formatDate(createdAtField)}
            </Typography>
          )}
        </Box>

        {/* Actions: Preview and Payment/Link buttons - Mobile optimized */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={handleDetailsClick}
            sx={{
              py: 0.75,
              fontWeight: 'bold',
              fontSize: '0.875rem',
              textTransform: 'none',
              borderRadius: '999px',
              borderColor: 'rgba(227,27,35,0.6)',
              color: '#ffc2c6',
              '&:hover': {
                borderColor: 'rgba(227,27,35,0.85)',
                backgroundColor: 'rgba(227,27,35,0.12)',
              },
            }}
          >
            Details
          </Button>

          {/* Conditional second row based on video type */}
          {video.is_free && video.product_link ? (
            // For FREE videos with product link
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              onClick={e => {
                e.stopPropagation();
                window.open(video.product_link, '_blank');
              }}
              sx={{ 
                py: 0.75,
                fontWeight: 'bold',
                fontSize: '0.875rem',
                textTransform: 'none',
              }}
            >
              Product Link
            </Button>
          ) : !video.is_free ? (
            // For PAID videos - Payment options in row
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  py: 0.75,
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  borderRadius: '999px',
                  borderColor: 'rgba(227,27,35,0.6)',
                  color: '#ffc2c6',
                  '&:hover': {
                    borderColor: 'rgba(227,27,35,0.8)',
                    backgroundColor: 'rgba(227,27,35,0.12)',
                  },
                }}
              >
                Telegram
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={handleStripePay}
                disabled={isStripeLoading}
                sx={{
                  py: 0.75,
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  borderRadius: '999px',
                  background: '#e31b23',
                  color: 'white',
                  '&:hover': {
                    background: '#c9151d',
                  },
                  '&:disabled': {
                    background: '#555',
                    color: '#999'
                  }
                }}
              >
                Payment Options
              </Button>
            </Box>
          ) : null}
        </Box>

        {!video.is_free && (
          <Box sx={{ mt: 1.1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ color: '#7b747f', textDecoration: 'line-through', fontWeight: 600, fontSize: '0.95rem' }}>
              ${(video.price * 2).toFixed(0)}
            </Typography>
            <Typography sx={{ color: '#ff4a55', fontWeight: 900, fontSize: '1.8rem', lineHeight: 1 }}>
              ${video.price.toFixed(0)}
            </Typography>
            <Chip
              label={`SAVE $${Math.max(0, Math.round(video.price)).toFixed(0)}`}
              size="small"
              sx={{
                height: '26px',
                fontWeight: 800,
                background: '#e31b23',
                color: 'white',
                '& .MuiChip-label': { px: 1.2 },
              }}
            />
          </Box>
        )}

      </CardContent>
      </Card>

      {/* Payment Options Modal */}
      {!video.is_free && (
        <Dialog 
          open={showPaymentModal} 
          onClose={() => setShowPaymentModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background: theme => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #140000 0%, #220000 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #fff0f0 100%)',
              borderRadius: 3,
              border: theme => theme.palette.mode === 'dark'
                ? '1px solid rgba(255,70,70,0.45)'
                : '1px solid rgba(255,70,70,0.25)',
              boxShadow: theme => theme.palette.mode === 'dark'
                ? '0 18px 40px rgba(15,23,42,0.9)'
                : '0 14px 32px rgba(15,23,42,0.25)',
            }
          }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: theme => theme.palette.mode === 'dark' ? '1px solid rgba(255,70,70,0.4)' : '1px solid rgba(255,70,70,0.2)' }}>
            <Typography variant="h6" sx={{ color: theme => theme.palette.mode === 'dark' ? 'white' : '#0f172a', fontWeight: 'bold' }}>
              Select Payment Method
            </Typography>
            <Button onClick={() => setShowPaymentModal(false)} sx={{ color: theme => theme.palette.mode === 'dark' ? '#e5e7eb' : '#0f172a', minWidth: 'auto', p: 0 }}>
              x
            </Button>
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {/* Privacy and delivery notice */}
            <Box sx={{ mb: 2, p: 1.5, backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255,40,40,0.18)' : 'rgba(255,220,220,0.7)', borderRadius: 2, border: theme => theme.palette.mode === 'dark' ? '1px solid rgba(255,70,70,0.65)' : '1px solid rgba(255,70,70,0.35)' }}>
              <Typography variant="body2" sx={{ color: theme => theme.palette.mode === 'dark' ? '#ffd6d6' : '#a40000', textAlign: 'center', fontWeight: 'bold' }}>
                For privacy, generic names will appear during automatic payment checkout.<br />
                Content is delivered automatically after payment.
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: theme => theme.palette.text.secondary, mb: 3, textAlign: 'center' }}>
              Video: <strong>{video.title}</strong>
              <br />
              Price: <strong style={{ color: '#ff4a55' }}>${video.price.toFixed(2)}</strong>
            </Typography>

            {/* PayJSR — só se chave no admin ou VITE_PAYJSR_ENABLED */}
            {!configLoading && isPayJsrCheckoutAvailable(stripeSecretKey) && (
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleStripePayment}
                disabled={isStripeLoading}
                sx={{
                  mb: 2,
                  py: 2,
                  background: '#e31b23',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  '&:hover': {
                    background: '#c9151d',
                  },
                  '&:disabled': {
                    background: '#555',
                    color: '#999'
                  }
                }}
              >
                {isStripeLoading ? 'Processing...' : 'Pay (Card, Apple Pay etc)'}
              </Button>
            )}

            {/* Whop Payment - Only show if configured */}
            {!configLoading && whoApiKey && whoApiKey.trim() !== '' && (
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleWhoPayment}
                disabled={isStripeLoading || !whoApiKey}
                sx={{
                  mb: 2,
                  py: 2,
                  background: '#e31b23',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  '&:hover': {
                    background: '#c9151d',
                  },
                  '&:disabled': {
                    background: '#555',
                    color: '#999'
                  }
                }}
              >
                {isStripeLoading ? 'Processing...' : 'Pay with Whop'}
              </Button>
            )}

            {/* PayPal masked checkout */}
            {!configLoading && paypalClientId && paypalClientId.trim() !== '' && (
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handlePayPalPayment}
                disabled={isStripeLoading}
                sx={{
                  mb: 2,
                  py: 2,
                  background: '#e31b23',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  '&:hover': {
                    background: '#c9151d',
                  },
                  '&:disabled': {
                    background: '#555',
                    color: '#999'
                  }
                }}
              >
                {isStripeLoading ? 'Processing...' : 'Pay with PayPal or card'}
              </Button>
            )}

            {/* Crypto Payment */}
            <Box>
              {cryptoWallets && cryptoWallets.length > 0 ? (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel sx={{ color: '#ccc' }}>Select Crypto Wallet</InputLabel>
                    <Select
                      value={selectedCryptoWallet}
                      onChange={(e) => setSelectedCryptoWallet(e.target.value)}
                      sx={{
                        color: 'white',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme => theme.palette.primary.main,
                        },
                        '& .MuiSvgIcon-root': {
                          color: '#ccc'
                        }
                      }}
                    >
                      {cryptoWallets.map((wallet: string, index: number) => {
                        const [cryptoType] = wallet.split(':');
                        return (
                          <MenuItem key={index} value={wallet}>
                            {cryptoType.toUpperCase()} Wallet
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleCryptoPayment}
                    disabled={!selectedCryptoWallet || !telegramUsername}
                    sx={{
                      py: 2,
                      background: '#e31b23',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      '&:hover': {
                        background: '#c9151d',
                      },
                      '&:disabled': {
                        background: '#555',
                        color: '#999'
                      }
                    }}
                  >
                    Pay with Cryptocurrency
                  </Button>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: '#999', textAlign: 'center', py: 2 }}>
                  Crypto wallets not configured
                </Typography>
              )}
            </Box>

            {/* Bonus Message */}
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(227, 27, 35, 0.08)', borderRadius: 2, border: '1px solid rgba(227, 27, 35, 0.3)' }}>
              <Typography variant="body2" sx={{ color: '#ffc2c6', textAlign: 'center', fontWeight: 'bold' }}>
                🎁 Bonus: After payment, message us on Telegram for free bonus pack!
              </Typography>
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {/* Details Modal */}
      <Dialog
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(180deg, rgba(12,12,14,0.98) 0%, rgba(8,8,10,0.98) 100%)',
            borderRadius: 3,
            border: '1px solid rgba(227,27,35,0.55)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.7)',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5 }}>
          <Typography sx={{ fontWeight: 900, color: '#f2f2f3' }}>{video.title}</Typography>
          <Button onClick={() => setShowDetailsModal(false)} sx={{ color: '#ffc2c6', minWidth: 'auto', p: 0 }}>
            x
          </Button>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body2" sx={{ color: '#b8b2be', mb: 2 }}>
            {video.description || 'No description available'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={`Views: ${formatViews(video.views)}`}
              size="small"
              sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
            />
            {createdAtField && (
              <Chip
                label={`Added: ${formatDate(createdAtField)}`}
                size="small"
                sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
              />
            )}
            {video.duration && (
              <Chip
                label={`Duration: ${formatDuration(video.duration)}`}
                size="small"
                sx={{ bgcolor: 'rgba(15,15,17,0.96)', color: '#ffc2c6', border: '1px solid rgba(227,27,35,0.5)', fontWeight: 800 }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Typography sx={{ color: '#7b747f', textDecoration: 'line-through', fontWeight: 600, fontSize: '1rem' }}>
              ${(video.price * 2).toFixed(0)}
            </Typography>
            <Typography sx={{ color: '#ff4a55', fontWeight: 900, fontSize: '2.1rem', lineHeight: 1 }}>
              ${video.price.toFixed(0)}
            </Typography>
            <Chip
              label={`SAVE $${Math.max(0, Math.round(video.price)).toFixed(0)}`}
              size="small"
              sx={{ height: '28px', fontWeight: 900, background: '#e31b23', color: 'white', '& .MuiChip-label': { px: 1.2 } }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              fullWidth
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                borderRadius: '999px',
                borderColor: 'rgba(227,27,35,0.6)',
                color: '#ffc2c6',
                '&:hover': { borderColor: 'rgba(227,27,35,0.85)', backgroundColor: 'rgba(227,27,35,0.12)' },
              }}
            >
              Telegram
            </Button>
            {!video.is_free && (
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  setShowDetailsModal(false);
                  setShowPaymentModal(true);
                }}
                sx={{
                  borderRadius: '999px',
                  background: '#e31b23',
                  '&:hover': { background: '#c9151d' },
                }}
              >
                Payment Options
              </Button>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VideoCard; 