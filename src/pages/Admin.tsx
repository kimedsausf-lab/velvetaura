import { useState, useEffect, useRef, ChangeEvent } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/Auth';
import { VideoService } from '../services/VideoService';
import { SupabaseService } from '../services/SupabaseService';
import { wasabiService } from '../services/WasabiService';
import { useSiteConfig } from '../context/SiteConfigContext';
import FormControlLabel from '@mui/material/FormControlLabel';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';

const SendIcon: FC = () => <span aria-hidden="true">↗</span>;
const DeleteIcon: FC = () => <span aria-hidden="true">✕</span>;
const SaveIcon: FC = () => <span aria-hidden="true">✓</span>;
const EditIcon: FC = () => <span aria-hidden="true">✎</span>;
const CancelIcon: FC = () => <span aria-hidden="true">✕</span>;
const AddIcon: FC = () => <span aria-hidden="true">＋</span>;
const RemoveIcon: FC = () => <span aria-hidden="true">−</span>;
const SearchIcon: FC = () => <span aria-hidden="true">⌕</span>;
const CloudUploadIcon: FC = () => <span aria-hidden="true">↑</span>;
const VideoLibraryIcon: FC = () => <span aria-hidden="true">▶</span>;
const SettingsIcon: FC = () => <span aria-hidden="true">⚙</span>;
const GroupIcon: FC = () => <span aria-hidden="true">👥</span>;
const SecurityIcon: FC = () => <span aria-hidden="true">🛡</span>;

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Styled components for file upload
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

// Custom Alert component
const CustomAlert = React.forwardRef<HTMLDivElement, AlertProps>((props, ref) => {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

// Video interface
interface Video {
  $id: string;
  title: string;
  description: string;
  price: number;
  product_link?: string;
  video_id?: string;
  thumbnail_id?: string;
  created_at: string;
  is_active: boolean;
  duration?: number;
  is_free?: boolean;
}

// User interface
interface User {
  $id: string;
  email: string;
  name: string;
  password: string;
  created_at: string;
}

// Site config interface
interface SiteConfig {
  $id: string;
  site_name: string;
  who_api_key: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  paypal_client_id?: string;
  telegram_username: string;
  video_list_title?: string;
  crypto?: string[];
  email_host?: string;
  email_port?: string;
  email_secure?: boolean;
  email_user?: string;
  email_pass?: string;
  email_from?: string;
  wasabi_config?: {
    accessKey: string;
    secretKey: string;
    region: string;
    bucket: string;
    endpoint: string;
  };
}

// Admin page component
// Hash password using Web Crypto API (browser)
async function hashPasswordWithWebCrypto(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const Admin: FC = () => {
  const { user } = useAuth();
  const { refreshConfig, updateConfig } = useSiteConfig();
  const [tabValue, setTabValue] = useState(0);
  
  // Videos state
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  
  // Video form state
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoPrice, setVideoPrice] = useState('');
  const [productLink, setProductLink] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isFree, setIsFree] = useState<boolean>(false);
  
  // Sources state (multiple files for the same title)
  const [relatedVideos, setRelatedVideos] = useState<Array<{
    id: string;
    videoFile: File | null; // source file
    duration: number | null; // optional, not stored in video_sources
  }>>([]);

  // Store source files directly for upload
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);

  const [showRelatedVideos, setShowRelatedVideos] = useState(false);
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newUser, setNewUser] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  
  // Site config state
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  
  // Purchases state
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [whoApiKey, setWhoApiKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [videoListTitle, setVideoListTitle] = useState('');
  const [cryptoWallets, setCryptoWallets] = useState<string[]>([]);
  const [newCryptoWallet, setNewCryptoWallet] = useState('');
  
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [editingConfig, setEditingConfig] = useState(false);
  
  // Email config state
  const [emailHost, setEmailHost] = useState('');
  const [emailPort, setEmailPort] = useState('');
  const [emailSecure, setEmailSecure] = useState(false);
  const [emailUser, setEmailUser] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  
  // Wasabi config state
  const [wasabiAccessKey, setWasabiAccessKey] = useState('');
  const [wasabiSecretKey, setWasabiSecretKey] = useState('');
  const [wasabiRegion, setWasabiRegion] = useState('');
  const [wasabiBucket, setWasabiBucket] = useState('');
  const [wasabiEndpoint, setWasabiEndpoint] = useState('');
  
  // Available cryptocurrencies
  const cryptoCurrencies = [
    { code: 'BTC', name: 'Bitcoin' },
    { code: 'ETH', name: 'Ethereum' },
    { code: 'USDT', name: 'Tether USD' },
    { code: 'BNB', name: 'Binance Coin' },
    { code: 'SOL', name: 'Solana' },
    { code: 'XRP', name: 'Ripple' },
    { code: 'ADA', name: 'Cardano' },
    { code: 'DOGE', name: 'Dogecoin' },
    { code: 'AVAX', name: 'Avalanche' },
    { code: 'DOT', name: 'Polkadot' },
    { code: 'MATIC', name: 'Polygon' },
    { code: 'SHIB', name: 'Shiba Inu' }
  ];
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'video' | 'user', id: string } | null>(null);
  
  // Feedback snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  
  // Video element ref for getting duration
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Event listener for show-feedback events
  useEffect(() => {
    const handleShowFeedback = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string, severity: 'success' | 'error' }>;
      setSnackbarMessage(customEvent.detail.message);
      setSnackbarSeverity(customEvent.detail.severity);
      setSnackbarOpen(true);
    };
    
    document.addEventListener('show-feedback', handleShowFeedback);
    
    return () => {
      document.removeEventListener('show-feedback', handleShowFeedback);
    };
  }, []);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Load videos on mount and tab change
  useEffect(() => {
    if (tabValue === 0) {
      fetchVideos();
    } else if (tabValue === 1) {
      fetchPurchases();
    } else if (tabValue === 2) {
      fetchUsers();
      fetchSiteConfig();
    }
  }, [tabValue]);

  // Fetch videos from database
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allVideos = await VideoService.getAllVideos();
      console.log(`Admin: Fetched ${allVideos.length} videos using VideoService`);
      
      // Convert VideoService format to Admin format
      const adminVideos = allVideos.map(video => ({
        $id: video.$id,
        title: video.title,
        description: video.description,
        price: video.price,
        product_link: video.product_link || '',
        video_id: video.video_id || video.videoFileId,
        thumbnail_id: video.thumbnail_id || video.thumbnailFileId,
        created_at: video.created_at,
        is_active: true,
        duration: typeof video.duration === 'string' ? 
          // Convert duration string (MM:SS or HH:MM:SS) to seconds
          video.duration.split(':').reduce((acc, time) => (60 * acc) + parseInt(time), 0) : 
          undefined,
        is_free: video.is_free,
      })) as unknown as Video[];
      
      setVideos(adminVideos);
      setFilteredVideos(adminVideos);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch users from database
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const usersData = await SupabaseService.listUsers();
      
      // Convert to admin format
      const adminUsers = usersData.map(user => ({
        $id: user.id,
        email: user.email,
        name: user.name,
        password: '', // Don't expose password hash
        created_at: user.created_at
      })) as unknown as User[];
      
      setUsers(adminUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchases from database
  const fetchPurchases = async () => {
    try {
      setLoadingPurchases(true);
      setError(null);
      
      const purchasesData = await SupabaseService.listPurchases(100);
      setPurchases(purchasesData);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setError('Failed to load purchases. Please try again.');
    } finally {
      setLoadingPurchases(false);
    }
  };
  
  // Fetch site configuration
  const fetchSiteConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const resp = await fetch(`${API_BASE_URL}/api/site-config`);
      if (!resp.ok) throw new Error(`Failed to fetch site config: ${resp.status}`);
      const configData = await resp.json();

      const config: SiteConfig = {
        $id: configData.id || 'site-config',
        site_name: configData.site_name || '',
        who_api_key: configData.who_api_key || '',
        stripe_publishable_key: configData.stripe_publishable_key || '',
        stripe_secret_key: configData.payjsr_secret_key || configData.stripe_secret_key || '',
        paypal_client_id: configData.paypal_client_id || '',
        telegram_username: configData.telegram_username || '',
        video_list_title: configData.video_list_title || 'Available Videos',
        crypto: Array.isArray(configData.crypto) ? configData.crypto : [],
        email: configData.email || {},
        wasabi_config: configData.wasabi_config || configData.wasabiConfig || undefined,
      } as any;

      setSiteConfig(config);
      setSiteName(config.site_name);
      setWhoApiKey(config.who_api_key);
      setStripePublishableKey(config.stripe_publishable_key || '');
      setStripeSecretKey(config.stripe_secret_key || '');
      setPaypalClientId(config.paypal_client_id || '');
      setTelegramUsername(config.telegram_username);
      setVideoListTitle(config.video_list_title || 'Available Videos');
      setCryptoWallets(config.crypto || []);

      // Email settings
      setEmailHost(config.email?.host || '');
      setEmailPort(config.email?.port || '');
      setEmailSecure(!!config.email?.secure);
      setEmailUser(config.email?.user || '');
      setEmailPass(config.email?.pass || '');
      setEmailFrom(config.email?.from || '');

      // Wasabi settings (merge env already returned by API if present)
      if (config.wasabi_config) {
        setWasabiAccessKey(config.wasabi_config.accessKey || config.wasabi_config.access_key || '');
        setWasabiSecretKey(config.wasabi_config.secretKey || config.wasabi_config.secret_key || '');
        setWasabiRegion(config.wasabi_config.region || '');
        setWasabiBucket(config.wasabi_config.bucket || '');
        setWasabiEndpoint(config.wasabi_config.endpoint || '');
      }
    } catch (err) {
      console.error('Error fetching site config:', err);
      setError('Failed to load site configuration');
    } finally {
      setLoading(false);
    }
  };

  // Filter videos when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredVideos(videos);
    } else {
      const term = searchTerm.toLowerCase().trim();
      const filtered = videos.filter(
        video => 
          video.title.toLowerCase().includes(term) || 
          video.description.toLowerCase().includes(term)
      );
      setFilteredVideos(filtered);
    }
  }, [searchTerm, videos]);

  // Delete video
  const handleDeleteVideo = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const success = await VideoService.deleteVideo(id);
      
      if (success) {
        showFeedback('Video successfully deleted!', 'success');
        fetchVideos();
      } else {
        showFeedback('Failed to delete video', 'error');
      }
    } catch (err) {
      console.error('Error deleting video:', err);
      showFeedback('Failed to delete video. Please try again.', 'error');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };
  
  // Delete user
  const handleDeleteUser = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let success = false;
      try {
        await SupabaseService.deleteUser(id);
        success = true;
      } catch (e) {
        success = false;
      }
      
      if (success) {
        showFeedback('User successfully deleted!', 'success');
        fetchUsers();
      } else {
        showFeedback('Failed to delete user', 'error');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      showFeedback('Failed to delete user. Please try again.', 'error');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Related videos functions
  const addRelatedVideo = () => {
    const genId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const newRelatedVideo = {
      id: genId,
      videoFile: null,
      duration: null,
    } as any;
    setRelatedVideos([...relatedVideos, newRelatedVideo]);
  };

  const removeRelatedVideo = (id: string) => {
    setRelatedVideos(relatedVideos.filter(video => video.id !== id));
  };

  const updateRelatedVideo = (id: string, field: string, value: any) => {
    setRelatedVideos(relatedVideos.map(video => 
      video.id === id ? { ...video, [field]: value } : video
    ));
  };

  // Save video (create or update)
  const handleSaveVideo = async () => {
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      if (!videoTitle || !videoDescription || !videoPrice) {
        showFeedback('Please fill in all required fields', 'error');
        return;
      }

      const price = parseFloat(videoPrice);
      if (isNaN(price) || price < 0) {
        showFeedback('Please enter a valid price', 'error');
        return;
      }

      let videoFileId = '';
      let thumbnailFileId = '';

      // Se estiver editando, carregar dados existentes primeiro
      if (editingVideo) {
        const existingVideo = videos.find(v => v.$id === editingVideo);
        if (existingVideo) {
          // Preservar IDs existentes se não houver novos arquivos
          videoFileId = existingVideo.video_id || existingVideo.videoFileId || '';
          thumbnailFileId = existingVideo.thumbnail_id || existingVideo.thumbnailFileId || '';
        }
      }

      // Upload video file if provided (apenas se houver novo arquivo)
      if (videoFile) {
        setUploadProgress(20);
        const videoResult = await wasabiService.uploadFile(videoFile, 'videos');
        if (!videoResult.success) {
          showFeedback('Failed to upload video file', 'error');
          return;
        }
        videoFileId = videoResult.fileId;
        setUploadProgress(60);
      }

      // Upload thumbnail if provided (apenas se houver novo arquivo)
      if (thumbnailFile) {
        const thumbnailResult = await wasabiService.uploadFile(thumbnailFile, 'thumbnails');
        if (!thumbnailResult.success) {
          showFeedback('Failed to upload thumbnail', 'error');
          return;
        }
        thumbnailFileId = thumbnailResult.fileId;
        setUploadProgress(80);
      }

      // Preparar dados para atualização
      const videoData: any = {
        title: videoTitle,
        description: videoDescription,
        price: price,
        productLink: productLink || undefined,
        isActive: true,
        is_free: isFree,
      };

      // Adicionar duração se fornecida ou se for novo vídeo
      if (videoDuration) {
        videoData.duration = `${Math.floor(videoDuration / 60)}:${(videoDuration % 60).toString().padStart(2, '0')}`;
      } else if (!editingVideo) {
        videoData.duration = '00:00';
      }

      // Adicionar IDs de arquivos apenas se foram fornecidos
      if (videoFileId) {
        videoData.videoFileId = videoFileId;
        videoData.video_id = videoFileId; // Para compatibilidade
      }
      
      if (thumbnailFileId) {
        videoData.thumbnailFileId = thumbnailFileId;
        videoData.thumbnail_id = thumbnailFileId; // Para compatibilidade
      }

      setUploadProgress(90);

      // Sources handling (video_sources) - moved to after main video creation/update

      const uploadAndInsert = async (videoIdForInsert: string) => {
        let created = 0;
        console.log('[admin] uploadAndInsert using sourceFiles:', sourceFiles.map(f => f.name));
        
        for (let index = 0; index < sourceFiles.length; index++) {
          const file = sourceFiles[index];
          console.log(`[admin] uploading source ${index + 1}/${sourceFiles.length}:`, file.name, file.type, file.size);
          const sourceUpload = await wasabiService.uploadFile(file, 'videos');
          if (!sourceUpload.success) {
            showFeedback('Failed to upload a source file', 'error');
            continue;
          }
          const thumbId: string | undefined = undefined; // no per-source thumbnails
          try {
            await SupabaseService.addVideoSource(videoIdForInsert, sourceUpload.fileId, thumbId, index + 1);
            created++;
          } catch (e) {
            console.error('Failed to insert video source:', e);
          }
        }
        return created;
      };

      // Supabase write path
      if (SupabaseService.isConfigured()) {
        let videoId = '';
        
        if (editingVideo) {
          const updates: any = {
            title: videoData.title,
            description: videoData.description,
            price: videoData.price,
            duration: videoData.duration,
            video_file_id: videoData.videoFileId,
            thumbnail_file_id: videoData.thumbnailFileId,
            product_link: videoData.productLink,
            is_active: true,
            is_free: isFree,
          };
          await SupabaseService.updateVideo(editingVideo, updates);
          videoId = editingVideo;
          showFeedback('Video updated successfully!', 'success');
        } else {
          const created = await SupabaseService.createVideo({
            title: videoData.title,
            description: videoData.description,
            price: videoData.price,
            duration: videoData.duration,
            video_file_id: videoData.videoFileId,
            thumbnail_file_id: videoData.thumbnailFileId,
            product_link: videoData.productLink,
            is_active: true,
            is_free: isFree,
          });
          videoId = created.id;
          showFeedback('Video uploaded successfully!', 'success');
        }

        // Handle sources AFTER main video is created/updated
        const hasSources = sourceFiles.length > 0;
        console.log('[admin] hasSources:', hasSources, 'sourceFiles:', sourceFiles.map(f => f.name));
        
        if (hasSources) {
          console.log('[admin] calling uploadAndInsert for video:', videoId);
          const count = await uploadAndInsert(videoId);
          showFeedback(`Uploaded ${count} source(s)`, 'success');
        }

        fetchVideos();
        setShowVideoForm(false);
        setEditingVideo(null);
      } else {
        showFeedback('Supabase not configured', 'error');
      }

      setUploadProgress(100);

      // Reset form
      setVideoTitle('');
      setVideoDescription('');
      setVideoPrice('');
      setProductLink('');
      setVideoFile(null);
      setThumbnailFile(null);
      setVideoDuration(null);
      setSourceFiles([]);
      setIsFree(false);

    } catch (err) {
      console.error('Error saving video:', err);
      showFeedback('Failed to save video. Please try again.', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Save site configuration
  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const configData = {
        siteName: siteName,
        whoApiKey: whoApiKey,
        stripePublishableKey: stripePublishableKey,
        stripeSecretKey: stripeSecretKey,
        paypalClientId: paypalClientId,
        telegramUsername: telegramUsername,
        videoListTitle: videoListTitle,
        crypto: cryptoWallets,
        emailHost: emailHost,
        emailPort: emailPort,
        emailSecure: emailSecure,
        emailUser: emailUser,
        emailPass: emailPass,
        emailFrom: emailFrom,
        wasabiConfig: {
          accessKey: wasabiAccessKey,
          secretKey: wasabiSecretKey,
          region: wasabiRegion,
          bucket: wasabiBucket,
          endpoint: wasabiEndpoint
        }
      };

      // Save to Supabase via API
      const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const payload: any = {
        site_name: configData.siteName,
        who_api_key: configData.whoApiKey,
        stripe_publishable_key: configData.stripePublishableKey,
        stripe_secret_key: configData.stripeSecretKey?.trim(),
        paypal_client_id: configData.paypalClientId,
        telegram_username: configData.telegramUsername,
        video_list_title: configData.videoListTitle,
        crypto: configData.crypto,
        email: {
          host: configData.emailHost,
          port: configData.emailPort,
          secure: configData.emailSecure,
          user: configData.emailUser,
          pass: configData.emailPass,
          from: configData.emailFrom
        }
      };
      // Only send wasabi_config if all fields are present to avoid 400 from API
      const wc = configData.wasabiConfig || ({} as any);
      const hasAllWasabi = [wc.accessKey, wc.secretKey, wc.region, wc.bucket, wc.endpoint]
        .every(v => typeof v === 'string' ? v.trim().length > 0 : !!v);
      if (hasAllWasabi) {
        payload.wasabi_config = {
          accessKey: wc.accessKey?.trim(),
          secretKey: wc.secretKey?.trim(),
          region: wc.region?.trim(),
          bucket: wc.bucket?.trim(),
          endpoint: wc.endpoint?.trim()
        };
      }
      const resp = await fetch(`${API_BASE_URL}/api/site-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        throw new Error(`Failed to save config: ${resp.status} ${resp.statusText}`);
      }
      showFeedback('Configuration saved successfully!', 'success');
      setEditingConfig(false);
      fetchSiteConfig();
      
    } catch (err) {
      console.error('Error saving configuration:', err);
      showFeedback('Failed to save configuration. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
            <Tab label="Manage Videos" />
            <Tab label="Purchases" />
            <Tab label="Site Configuration & Users" />
          </Tabs>
        </Box>
        
        {/* Videos Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 4 }}>
            <Grid container spacing={2} alignItems="center" justifyContent="space-between">
              <Grid item>
                <Typography variant="h5" component="h2" gutterBottom>
                  Manage Videos
                </Typography>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowVideoForm(!showVideoForm)}
                >
                  {showVideoForm ? 'Hide Form' : 'Upload New Video'}
                </Button>
              </Grid>
            </Grid>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
          
          {loading && !error ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Search box */}
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <TextField
                  fullWidth
                  placeholder="Pesquisar vídeos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">⌕</InputAdornment>,
                  }}
                />
              </Box>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Free</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredVideos.map((video) => (
                      <TableRow key={video.$id}>
                        <TableCell>{video.title}</TableCell>
                        <TableCell>${video.price}</TableCell>
                        <TableCell>{video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '00:00'}</TableCell>
                        <TableCell>{video.is_active ? 'Active' : 'Inactive'}</TableCell>
                        <TableCell align="center">
                          {video.is_free ? <Chip color="success" size="small" label="FREE" /> : ''}
                        </TableCell>
                        <TableCell>
                          <IconButton 
                            color="primary" 
                            onClick={() => {
                              setVideoTitle(video.title);
                              setVideoDescription(video.description);
                              setVideoPrice(video.price.toString());
                              setProductLink(video.product_link || '');
                              setVideoDuration(video.duration || null);
                              setEditingVideo(video.$id);
                              setIsFree(Boolean(video.is_free));
                              setShowVideoForm(true);
                            }}
                            aria-label="edit video"
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            ✎
                          </IconButton>
                          <IconButton 
                            color="error" 
                            onClick={() => {
                              setItemToDelete({ type: 'video', id: video.$id });
                              setDeleteDialogOpen(true);
                            }}
                            aria-label="delete video"
                          >
                            ✕
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredVideos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          {searchTerm.trim() ? 'No videos found matching your search' : 'No videos found'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          
          {/* Video Form */}
          {showVideoForm && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" component="h3" sx={{ mb: 3 }}>
                {editingVideo ? 'Edit Video' : 'Upload New Video'}
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Video Title"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Description"
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                    variant="outlined"
                    multiline
                    rows={3}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Price (USD)"
                    type="number"
                    value={videoPrice}
                    onChange={(e) => setVideoPrice(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Product Link (optional)"
                    value={productLink}
                    onChange={(e) => setProductLink(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Video File
                    </Typography>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setVideoFile(file);
                          // Get video duration
                          const video = document.createElement('video');
                          video.preload = 'metadata';
                          video.onloadedmetadata = () => {
                            setVideoDuration(video.duration);
                          };
                          video.src = URL.createObjectURL(file);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Thumbnail Image
                    </Typography>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setThumbnailFile(file);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </Box>
                  
                  {videoDuration && (
                    <Typography variant="body2" color="text.secondary">
                      Duration: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
                    </Typography>
                  )}
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch checked={isFree} onChange={e => setIsFree(e.target.checked)} color="success" />
                    }
                    label="Mark as Free"
                  />
                </Grid>
              </Grid>

              {/* Related Videos Section */}
              <Box sx={{ mt: 4, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" component="h4">
                    Related Videos (Optional)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const next = !showRelatedVideos;
                      setShowRelatedVideos(next);
                      if (next && relatedVideos.length === 0) {
                        setRelatedVideos([{ id: Date.now().toString(), videoFile: null, duration: null } as any]);
                      }
                    }}
                  >
                    {showRelatedVideos ? 'Hide Related Videos' : 'Add Related Videos'}
                  </Button>
                </Box>

                {showRelatedVideos && (
                  <Box sx={{ border: '1px dashed #ccc', borderRadius: 2, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Add multiple source files for this title. These will appear as previews and parts.
                    </Typography>
                    
                    {relatedVideos.map((relatedVideo, index) => (
                      <Paper key={relatedVideo.id} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle2">
                            Source {index + 1}
                          </Typography>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => removeRelatedVideo(relatedVideo.id)}
                          >
                            Remove
                          </Button>
                        </Box>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                              Source ordering is based on the list position.
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} md={6}>
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                                Video File
                              </Typography>
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    console.log('[admin] source file selected:', file.name, file.type, file.size);
                                    console.log('[admin] updating relatedVideo with id:', relatedVideo.id);
                                    updateRelatedVideo(relatedVideo.id, 'videoFile', file);
                                    
                                    // Store file directly for upload
                                    setSourceFiles(prev => [...prev, file]);
                                    console.log('[admin] sourceFiles updated:', [...sourceFiles, file].map(f => f.name));
                                    
                                    // Get video duration
                                    const video = document.createElement('video');
                                    video.preload = 'metadata';
                                    video.onloadedmetadata = () => {
                                      updateRelatedVideo(relatedVideo.id, 'duration', video.duration);
                                    };
                                    video.src = URL.createObjectURL(file);
                                  }
                                }}
                                style={{ width: '100%', fontSize: '14px' }}
                              />
                            </Box>
                            
                            {/* No per-source thumbnail upload anymore */}
                            
                            {relatedVideo.videoFile && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Selected: {(relatedVideo.videoFile as File).name}
                              </Typography>
                            )}
                            {relatedVideo.duration && (
                              <Typography variant="caption" color="text.secondary">
                                Duration: {Math.floor(relatedVideo.duration / 60)}:{(relatedVideo.duration % 60).toString().padStart(2, '0')}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </Paper>
                    ))}
                    
                    <Button
                      variant="outlined"
                      onClick={addRelatedVideo}
                      sx={{ mt: 1 }}
                    >
                      Add Another Source
                    </Button>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      Sources added: {sourceFiles.length} / {relatedVideos.length}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveVideo}
                  disabled={uploading || !videoTitle || !videoDescription || !videoPrice}
                >
                  {uploading ? 'Uploading...' : (editingVideo ? 'Update Video' : 'Upload Video')}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowVideoForm(false);
                    setEditingVideo(null);
                    setVideoTitle('');
                    setVideoDescription('');
                    setVideoPrice('');
                    setProductLink('');
                    setVideoFile(null);
                    setThumbnailFile(null);
                    setVideoDuration(null);
                    setRelatedVideos([]);
                    setShowRelatedVideos(false);
                    setIsFree(false);
                  }}
                >
                  Cancel
                </Button>
              </Box>
              
              {uploadProgress > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Upload Progress: {uploadProgress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              )}
            </Paper>
          )}
        </TabPanel>
        
        {/* Site Configuration & Users Tab */}
        {/* Purchases Tab - index 1 */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Purchase History
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
                {error}
              </Alert>
            )}

            {loadingPurchases ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell><strong>Buyer</strong></TableCell>
                      <TableCell><strong>Email</strong></TableCell>
                      <TableCell><strong>Video</strong></TableCell>
                      <TableCell><strong>Amount</strong></TableCell>
                      <TableCell><strong>Method</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Transaction ID</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          No purchases found
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell>
                            {new Date(purchase.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{purchase.buyer_name || 'N/A'}</TableCell>
                          <TableCell>{purchase.buyer_email}</TableCell>
                          <TableCell>
                            {purchase.video_title || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {purchase.amount} {purchase.currency?.toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={purchase.payment_method} 
                              size="small" 
                              color={purchase.payment_method === 'stripe' ? 'primary' : purchase.payment_method === 'who' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={purchase.status} 
                              size="small" 
                              color={purchase.status === 'completed' ? 'success' : purchase.status === 'failed' ? 'error' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title={purchase.transaction_id}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {purchase.transaction_id}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        {/* Site Configuration & Users Tab - index 2 */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 4 }}>
            <Grid container spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Grid item>
                <Typography variant="h5" component="h2">
                  Site Configuration
                </Typography>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setEditingConfig(!editingConfig)}
                >
                  {editingConfig ? 'Cancel Edit' : 'Edit Config'}
                </Button>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>

          {/* Site Configuration Form */}
          {editingConfig && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" component="h3" sx={{ mb: 3 }}>
                Site Settings
              </Typography>
              
              <Grid container spacing={3}>
                {/* Basic Site Info */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Site Name"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Video List Title"
                    value={videoListTitle}
                    onChange={(e) => setVideoListTitle(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Telegram Username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    variant="outlined"
                    placeholder="@username"
                    sx={{ mb: 2 }}
                  />
                </Grid>

                {/* Payment Settings */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Payment Settings
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Who API Key"
                    value={whoApiKey}
                    onChange={(e) => setWhoApiKey(e.target.value)}
                    variant="outlined"
                    type="password"
                    sx={{ mb: 2 }}
                    helperText="Enter your Whop API key (apik_...)"
                  />
                  
                  <TextField
                    fullWidth
                    label="Stripe Publishable Key"
                    value={stripePublishableKey}
                    onChange={(e) => setStripePublishableKey(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="PayJSR Secret Key"
                    type="password"
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                    helperText="Use your PayJSR server key (sk_live_... or sk_test_...)."
                  />
                  
                  <TextField
                    fullWidth
                    label="PayPal Client ID"
                    value={paypalClientId}
                    onChange={(e) => setPaypalClientId(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                    helperText="Enter your PayPal Client ID (starts with A... for production or A...sandbox for sandbox)"
                  />
                </Grid>

                {/* Email Settings */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Email Settings
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="SMTP Host"
                    value={emailHost}
                    onChange={(e) => setEmailHost(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="SMTP Port"
                    value={emailPort}
                    onChange={(e) => setEmailPort(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={emailSecure}
                        onChange={(e) => setEmailSecure(e.target.checked)}
                      />
                    }
                    label="Use SSL/TLS"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Email Username"
                    value={emailUser}
                    onChange={(e) => setEmailUser(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Email Password"
                    type="password"
                    value={emailPass}
                    onChange={(e) => setEmailPass(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="From Email"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>

                {/* Wasabi Settings */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Wasabi Storage Settings
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Access Key"
                    value={wasabiAccessKey}
                    onChange={(e) => setWasabiAccessKey(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Secret Key"
                    type="password"
                    value={wasabiSecretKey}
                    onChange={(e) => setWasabiSecretKey(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Region"
                    value={wasabiRegion}
                    onChange={(e) => setWasabiRegion(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Bucket Name"
                    value={wasabiBucket}
                    onChange={(e) => setWasabiBucket(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Endpoint"
                    value={wasabiEndpoint}
                    onChange={(e) => setWasabiEndpoint(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>

                {/* Crypto Wallets */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Cryptocurrency Wallets
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <FormControl sx={{ minWidth: 120 }}>
                      <InputLabel>Crypto</InputLabel>
                      <Select
                        value={selectedCrypto}
                        onChange={(e) => setSelectedCrypto(e.target.value)}
                        label="Crypto"
                      >
                        {cryptoCurrencies.map((crypto) => (
                          <MenuItem key={crypto.code} value={crypto.code}>
                            {crypto.name} ({crypto.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <TextField
                      label="Wallet Address"
                      value={newCryptoWallet}
                      onChange={(e) => setNewCryptoWallet(e.target.value)}
                      variant="outlined"
                      sx={{ flexGrow: 1 }}
                    />
                    
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (newCryptoWallet.trim()) {
                          setCryptoWallets([...cryptoWallets, `${selectedCrypto}:${newCryptoWallet}`]);
                          setNewCryptoWallet('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </Box>
                  
                  {cryptoWallets.length > 0 && (
                    <Box>
                      {cryptoWallets.map((wallet, index) => (
                        <Chip
                          key={index}
                          label={wallet}
                          onDelete={() => {
                            setCryptoWallets(cryptoWallets.filter((_, i) => i !== index));
                          }}
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveConfig}
                >
                  Save Configuration
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditingConfig(false);
                    fetchSiteConfig();
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          )}

          {/* Display Current Configuration */}
          {!editingConfig && siteConfig && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" component="h3" sx={{ mb: 3 }}>
                Current Configuration
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Site Name
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.site_name || 'Not set'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Video List Title
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.video_list_title || 'Not set'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Telegram Username
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.telegram_username || 'Not set'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Whop API Key
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.who_api_key ? '***' + siteConfig.who_api_key.slice(-4) : 'Not set'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Stripe Publishable Key
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.stripe_publishable_key ? '***' + siteConfig.stripe_publishable_key.slice(-4) : 'Not set'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    PayPal Client ID
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.paypal_client_id ? '***' + siteConfig.paypal_client_id.slice(-4) : 'Not set'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Wasabi Bucket
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {siteConfig.wasabi_config?.bucket || 'Not set'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Users Management Section */}
          <Box sx={{ mb: 4 }}>
            <Grid container spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Grid item>
                <Typography variant="h5" component="h2">
                  Admin Users Management
                </Typography>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    setNewUser(true);
                    setUserName('');
                    setUserEmail('');
                    setUserPassword('');
                    setEditingUser(null);
                  }}
                >
                  Add New Admin
                </Button>
              </Grid>
            </Grid>

            {loading && !error ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.$id}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.created_at ? 
                              new Date(user.created_at).toLocaleDateString('pt-BR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }) : 
                              'N/A'
                            }
                          </TableCell>
                          <TableCell>
                            <IconButton 
                              color="primary" 
                              onClick={() => {
                                setUserName(user.name);
                                setUserEmail(user.email);
                                setUserPassword('');
                                setEditingUser(user.$id);
                                setNewUser(false);
                              }}
                              aria-label="edit user"
                              size="small"
                              sx={{ mr: 1 }}
                            >
                              ✎
                            </IconButton>
                            <IconButton 
                              color="error" 
                              onClick={() => {
                                setItemToDelete({ type: 'user', id: user.$id });
                                setDeleteDialogOpen(true);
                              }}
                              aria-label="delete user"
                            >
                              ✕
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            No admin users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>

          {/* User Form */}
          {(newUser || editingUser) && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" component="h3" sx={{ mb: 3 }}>
                {newUser ? 'Add New Admin User' : 'Edit Admin User'}
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                    required
                  />
                  
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                    required
                  />
                  
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                    required
                    helperText={editingUser ? "Leave blank to keep current password" : "Enter a secure password"}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Admin users</strong> have full access to:
                    </Typography>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li>Manage videos (upload, edit, delete)</li>
                      <li>Configure site settings</li>
                      <li>Manage other admin users</li>
                      <li>Access all administrative functions</li>
                    </ul>
                  </Alert>
                  
                  {editingUser && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Warning:</strong> Changing user credentials will require the user to log in again.
                      </Typography>
                    </Alert>
                  )}
                </Grid>
              </Grid>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError(null);

                      if (!userName || !userEmail || (!userPassword && newUser)) {
                        showFeedback('Please fill in all required fields', 'error');
                        return;
                      }

                      if (newUser) {
                        // Create new user
                        const hashedPassword = await hashPasswordWithWebCrypto(userPassword);
                        const userData = {
                          name: userName,
                          email: userEmail,
                          password_hash: hashedPassword,
                          role: 'admin'
                        };
                        
                        await SupabaseService.createUser(userData);
                        showFeedback('Admin user created successfully!', 'success');
                      } else if (editingUser) {
                        // Update existing user
                        const updateData: any = {
                          name: userName,
                          email: userEmail
                        };
                        
                        // Only update password if provided
                        if (userPassword.trim()) {
                          const hashedPassword = await hashPasswordWithWebCrypto(userPassword);
                          updateData.password_hash = hashedPassword;
                        }
                        
                        await SupabaseService.updateUser(editingUser, updateData);
                        showFeedback('Admin user updated successfully!', 'success');
                      }

                      // Reset form and refresh users
                      setNewUser(false);
                      setEditingUser(null);
                      setUserName('');
                      setUserEmail('');
                      setUserPassword('');
                      fetchUsers();
                      
                    } catch (err) {
                      console.error('Error saving user:', err);
                      showFeedback('Failed to save user. Please try again.', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (newUser ? 'Create Admin User' : 'Update Admin User')}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={() => {
                    setNewUser(false);
                    setEditingUser(null);
                    setUserName('');
                    setUserEmail('');
                    setUserPassword('');
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          )}
        </TabPanel>

      </Paper>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              if (itemToDelete) {
                if (itemToDelete.type === 'video') {
                  handleDeleteVideo(itemToDelete.id);
                } else {
                  handleDeleteUser(itemToDelete.id);
                }
              }
            }} 
            color="error" 
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <CustomAlert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
        >
          {snackbarMessage}
        </CustomAlert>
      </Snackbar>
    </Container>
  );
};

export default Admin;

// Helper function to show feedback via snackbar
function showFeedback(message: string, severity: 'success' | 'error') {
  const event = new CustomEvent('show-feedback', {
    detail: { message, severity }
  });
  document.dispatchEvent(event);
}
