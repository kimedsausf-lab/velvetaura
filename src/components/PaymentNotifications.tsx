import type { FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Fade from '@mui/material/Fade';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import { VideoService, SortOption, type Video } from '../services/VideoService';
import type { Theme } from '@mui/material/styles';

type Provider = 'Stripe' | 'PayPal';

const usaFirstNames = [
  'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','William','Elizabeth',
  'David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen',
  'Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Dorothy','Mark','Sandra',
  'Donald','Ashley','Steven','Kimberly','Paul','Donna','Andrew','Emily','Joshua','Michelle'
];

const usaLastNames = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin'
];

const otherCountries = [
  { cc: 'GB', name: 'UK' },
  { cc: 'CA', name: 'Canada' },
  { cc: 'AU', name: 'Australia' },
  { cc: 'DE', name: 'Germany' },
  { cc: 'FR', name: 'France' }
];

function getRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function pickBuyer(): { countryLabel: string; countryEmoji: string } {
  const isUSA = Math.random() < 0.8; // majority USA
  if (isUSA) {
    return { countryLabel: 'USA', countryEmoji: '🇺🇸' };
  }
  const other = getRandom(otherCountries);
  const flags: Record<string, string> = { GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷' };
  return { countryLabel: other.name, countryEmoji: flags[other.cc] };
}

function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

const providerLabel = (provider: Provider): string => (provider === 'Stripe' ? 'Card' : 'Pay');

interface NotificationCardProps {
  visible: boolean;
  country: string;
  countryEmoji: string;
  provider: Provider;
  product: string;
  price: number;
}

const NotificationCard: FC<NotificationCardProps> = ({ visible, country, countryEmoji, provider, product, price }) => {
  return (
    <Fade in={visible} timeout={{ enter: 400, exit: 400 }}>
      <Paper elevation={6} sx={{ p: 1.5, borderRadius: 2, minWidth: 280, maxWidth: 360 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar sx={{ width: 32, height: 32 }}>{countryEmoji}</Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>Someone purchased • {country}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {providerLabel(provider)}
              <Box component="span" sx={{ ml: 0.5 }}>completed via {provider}</Box>
            </Typography>
            <Typography variant="body2" noWrap>
              {product} • {formatCurrency(price)}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Fade>
  );
};

const PaymentNotifications: FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<{ country: string; countryEmoji: string; provider: Provider; product: string; price: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await VideoService.getAllVideos(SortOption.NEWEST);
        if (!cancelled) setVideos(list);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nextDelayMs = () => {
    // Show a notification every 40 seconds after the first
    return 40000;
  };

  useEffect(() => {
    function scheduleNext(initial = false) {
      const delay = initial ? 5000 : nextDelayMs();
      const handle = window.setTimeout(() => {
        if (videos.length === 0) {
          scheduleNext(false);
          return;
        }
        const video: Video = getRandom(videos as Video[]);
        const buyer = pickBuyer();
        const provider: Provider = Math.random() < 0.6 ? 'Stripe' : 'PayPal';
        setPayload({
          country: buyer.countryLabel,
          countryEmoji: buyer.countryEmoji,
          provider,
          product: video.title,
          price: Number(video.price) || 0
        });
        setVisible(true);
        window.setTimeout(() => setVisible(false), 4200);
        scheduleNext(false);
      }, delay);
      timerRef.current = handle;
    }
    scheduleNext(true);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [videos]);

  if (!payload) return null;

  return (
    <Box sx={{ position: 'fixed', left: 16, top: 16, zIndex: (theme: Theme) => theme.zIndex.snackbar }}>
      <NotificationCard
        visible={visible}
        country={payload.country}
        countryEmoji={payload.countryEmoji}
        provider={payload.provider}
        product={payload.product}
        price={payload.price}
      />
    </Box>
  );
};

export default PaymentNotifications;


