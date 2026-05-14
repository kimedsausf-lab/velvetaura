import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TelegramIcon from '@mui/icons-material/Telegram';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import CloseIcon from '@mui/icons-material/Close';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Backdrop from '@mui/material/Backdrop';
import { useTheme } from '@mui/material/styles';
import jsPDF from 'jspdf';
import { VideoService } from '../services/VideoService';
import { useSiteConfig } from '../context/SiteConfigContext';
import TelegramService from '../services/TelegramService';
import { SupabaseService } from '../services/SupabaseService';

interface PaymentData {
  videoId: string;
  videoTitle: string;
  videoPrice: number;
  productLink?: string;
  transactionId: string;
  paymentMethod: 'stripe' | 'who' | 'paypal';
  buyerEmail?: string;
  buyerName?: string;
}

function formatPurchaseDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function buildTelegramSupportMessage(paymentData: PaymentData): string {
  return `🎬 **${paymentData.videoTitle}**

💰 **Price:** $${paymentData.videoPrice.toFixed(2)}
💳 **Payment Method:** ${paymentData.paymentMethod.toUpperCase()}
🆔 **Transaction ID:** ${paymentData.transactionId}
📅 **Purchase Date:** ${formatPurchaseDate(new Date())}

📝 **Description:**
I just completed my purchase and need access to the content.

Please provide me with the access details.`;
}

const PaymentSuccess: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { telegramUsername, siteName } = useSiteConfig();
  
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [isPayPalTelegramRedirect, setIsPayPalTelegramRedirect] = useState(false);

  // Guarda para salvar a compra apenas uma vez por sessão
  const purchaseSavedRef = useRef(false);

  useEffect(() => {
    const loadPaymentData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get parameters from URL
        const videoId = searchParams.get('video_id');
        // Para PayPal: order_id é o ID estável da transação; payer_id e buyer_email vêm do onApprove
        const orderId = searchParams.get('order_id');
        const paypalTokenFromQuery = new URLSearchParams(window.location.search).get('token');
        const sessionId = orderId || searchParams.get('session_id') || searchParams.get('token') || paypalTokenFromQuery;
        const paymentMethod = searchParams.get('payment_method') as 'stripe' | 'who' | 'paypal' || 'stripe';
        const buyerEmail = searchParams.get('buyer_email');
        const buyerName = searchParams.get('buyer_name');
        const offerType = searchParams.get('offer_type');

        // Se não tem video_id, pode ser oferta de todos os vídeos
        if (!videoId && !offerType) {
          setError('Invalid payment data. Video ID or offer type not found.');
          setLoading(false);
          return;
        }

        // Para oferta de todos os vídeos, usar lógica diferente
        if (offerType === 'all_content') {
          const price = parseFloat(searchParams.get('price') || '100');
          // Usar sessionId estável ou gerar um e guardar no sessionStorage para esta sessão
          const sessionKey = `purchase_txid_all_content_${paymentMethod}`;
          const storedTxId = sessionStorage.getItem(sessionKey);
          const generatedSessionId = sessionId || storedTxId || `who_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          if (!storedTxId) sessionStorage.setItem(sessionKey, generatedSessionId);

          const data: PaymentData = {
            videoId: 'all_videos',
            videoTitle: 'All Content Access',
            videoPrice: price,
            productLink: 'Contact support via Telegram for full access',
            transactionId: generatedSessionId,
            paymentMethod,
            buyerEmail: buyerEmail || undefined,
            buyerName: buyerName || undefined,
          };

          setPaymentData(data);

          // Salvar compra no Supabase apenas uma vez (guarda dupla: ref + sessionStorage)
          const alreadySaved = sessionStorage.getItem(`purchase_saved_${generatedSessionId}`);
          if (!purchaseSavedRef.current && !alreadySaved) {
            purchaseSavedRef.current = true;
            sessionStorage.setItem(`purchase_saved_${generatedSessionId}`, '1');
            try {
              const existing = await SupabaseService.getPurchaseByTransactionId(generatedSessionId);
              if (!existing) {
                await SupabaseService.createPurchase({
                  video_id: 'all_videos',
                  buyer_email: buyerEmail || 'unknown@example.com',
                  buyer_name: buyerName || null,
                  transaction_id: generatedSessionId,
                  payment_method: paymentMethod,
                  amount: price,
                  currency: 'usd',
                  status: 'completed',
                  video_title: 'All Content Access',
                  product_link: null,
                  metadata: { sessionId: generatedSessionId, paymentMethod, offerType: 'all_content' }
                });
                console.log('All content purchase saved to Supabase successfully');
                try {
                  await TelegramService.sendSaleNotification({
                    videoTitle: 'All Content Access',
                    videoPrice: price,
                    buyerEmail: buyerEmail || undefined,
                    buyerName: buyerName || undefined,
                    transactionId: generatedSessionId,
                    paymentMethod,
                    timestamp: new Date().toLocaleString('pt-BR')
                  });
                } catch (telegramError) {
                  console.error('Failed to send Telegram notification:', telegramError);
                }
              } else {
                console.log('Purchase already exists, skipping duplicate save.');
              }
            } catch (dbError) {
              console.error('Error saving all content purchase to Supabase:', dbError);
            }
          }

          setLoading(false);
          return;
        }

        // Fluxo normal para vídeo individual
        if (!videoId) {
          setError('Invalid payment data. Video ID not found.');
          setLoading(false);
          return;
        }

        // Get video details
        const video = await VideoService.getVideo(videoId);
        if (!video) {
          setError('Video not found.');
          setLoading(false);
          return;
        }

        // Usar sessionId estável ou recuperar/gerar e persistir no sessionStorage
        const sessionKey = `purchase_txid_${videoId}_${paymentMethod}`;
        const storedTxId = sessionStorage.getItem(sessionKey);
        const generatedTransactionId = sessionId || storedTxId || `${paymentMethod}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (!storedTxId) sessionStorage.setItem(sessionKey, generatedTransactionId);

        const data: PaymentData = {
          videoId,
          videoTitle: video.title,
          videoPrice: video.price,
          productLink: video.product_link,
          transactionId: generatedTransactionId,
          paymentMethod,
          buyerEmail: buyerEmail || undefined,
          buyerName: buyerName || undefined,
        };

        setPaymentData(data);

        // Salvar compra no Supabase apenas uma vez (guarda dupla: ref + sessionStorage)
        const alreadySaved = sessionStorage.getItem(`purchase_saved_${generatedTransactionId}`);
        if (!purchaseSavedRef.current && !alreadySaved) {
          purchaseSavedRef.current = true;
          sessionStorage.setItem(`purchase_saved_${generatedTransactionId}`, '1');
          try {
            const existing = await SupabaseService.getPurchaseByTransactionId(generatedTransactionId);
            if (!existing) {
              await SupabaseService.createPurchase({
                video_id: videoId,
                buyer_email: buyerEmail || 'unknown@example.com',
                buyer_name: buyerName || null,
                transaction_id: generatedTransactionId,
                payment_method: paymentMethod,
                amount: video.price,
                currency: 'usd',
                status: 'completed',
                video_title: video.title,
                product_link: video.product_link || null,
                metadata: { sessionId: generatedTransactionId, paymentMethod }
              });
              console.log('Purchase saved to Supabase successfully');
              try {
                await TelegramService.sendSaleNotification({
                  videoTitle: video.title,
                  videoPrice: video.price,
                  buyerEmail: buyerEmail || undefined,
                  buyerName: buyerName || undefined,
                  transactionId: generatedTransactionId,
                  paymentMethod,
                  timestamp: new Date().toLocaleString('pt-BR')
                });
              } catch (telegramError) {
                console.error('Failed to send Telegram notification:', telegramError);
              }
            } else {
              console.log('Purchase already exists, skipping duplicate save.');
            }
          } catch (dbError) {
            console.error('Error saving purchase to Supabase:', dbError);
          }
        }

      } catch (err) {
        console.error('Error loading payment data:', err);
        setError('Failed to load payment information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadPaymentData();
  }, [searchParams]);

  // PayPal: same flow as ebooks — after success, open Telegram with prefilled order details
  useEffect(() => {
    if (!paymentData || paymentData.paymentMethod !== 'paypal' || !telegramUsername) {
      setIsPayPalTelegramRedirect(false);
      return;
    }

    setIsPayPalTelegramRedirect(true);
    const encoded = encodeURIComponent(buildTelegramSupportMessage(paymentData));
    const url = `https://t.me/${telegramUsername.replace('@', '')}?text=${encoded}`;

    let seconds = 3;
    setRedirectCountdown(seconds);
    const intervalId = window.setInterval(() => {
      seconds -= 1;
      setRedirectCountdown(seconds);
    }, 1000);
    const timeoutId = window.setTimeout(() => {
      window.location.replace(url);
    }, 3000);

    return () => {
      setIsPayPalTelegramRedirect(false);
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [paymentData, telegramUsername]);

  // Auto-redirect to product link after successful payment (skip when PayPal → Telegram handles it)
  useEffect(() => {
    if (!paymentData?.productLink) return;
    if (paymentData.paymentMethod === 'paypal' && telegramUsername) return;

    const links = paymentData.productLink
      .split(/\s+/)
      .map(link => link.trim())
      .filter(link => /^https?:\/\//i.test(link));

    if (links.length === 0) return;

    const firstLink = links[0];
    let seconds = 3;
    setRedirectCountdown(seconds);

    const intervalId = window.setInterval(() => {
      seconds -= 1;
      setRedirectCountdown(seconds);
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      window.location.href = firstLink;
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [paymentData, telegramUsername]);


  // Split product links by space
  const getProductLinks = () => {
    if (!paymentData?.productLink) return [];
    return paymentData.productLink.split(/\s+/).filter(link => link.trim().length > 0);
  };

  // Copy product link to clipboard
  const copyToClipboard = () => {
    if (paymentData?.productLink) {
      navigator.clipboard.writeText(paymentData.productLink)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        })
        .catch(err => console.error('Failed to copy: ', err));
    }
  };

  // Copy individual link to clipboard
  const copyIndividualLink = (link: string, index: number) => {
    navigator.clipboard.writeText(link.trim())
      .then(() => {
        setCopiedLinkIndex(index);
        setTimeout(() => setCopiedLinkIndex(null), 3000);
      })
      .catch(err => console.error('Failed to copy: ', err));
  };

  // Generate PDF with product link
  const generatePDF = () => {
    if (!paymentData) return;
    
    try {
      const doc = new jsPDF();
      
      // Set font size and styles
      doc.setFontSize(22);
      doc.setTextColor(229, 9, 20); // Netflix red
      doc.text("ADULTFLIX", 105, 20, { align: "center" });
    
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("Purchase Receipt", 105, 30, { align: "center" });
    
      // Add horizontal line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 35, 190, 35);
      
      // Video details
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Video: ${paymentData.videoTitle}`, 20, 50);
      doc.text(`Purchase Date: ${formatPurchaseDate(new Date())}`, 20, 60);
      doc.text(`Price: $${paymentData.videoPrice.toFixed(2)}`, 20, 70);
      doc.text(`Payment Method: ${paymentData.paymentMethod.toUpperCase()}`, 20, 80);
      doc.text(`Transaction ID: ${paymentData.transactionId}`, 20, 90);
    
      // Product link section
      doc.setFontSize(14);
      doc.text("Your Product Link:", 20, 110);
      
      // Draw a box around the link
      doc.setDrawColor(229, 9, 20); // Netflix red
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(20, 115, 170, 20, 3, 3, 'FD');
    
      // Add the link text
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      if (paymentData.productLink) {
        doc.text(paymentData.productLink, 25, 127);
      } else {
        doc.text("Contact support via Telegram for access", 25, 127);
      }
    
      // Instructions
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.text("Instructions:", 20, 150);
      
      if (paymentData.productLink) {
        doc.text("1. Copy the link above and paste it in your browser", 25, 160);
        doc.text("2. The link will take you to your purchased content", 25, 170);
        doc.text("3. This link is for your personal use only", 25, 180);
        doc.text("4. Do not share this link with others", 25, 190);
      } else {
        doc.text("1. Contact support via Telegram to get access to your content", 25, 160);
        doc.text("2. Provide your purchase details when contacting support", 25, 170);
        doc.text("3. Support will provide you with access instructions", 25, 180);
      }
    
      // Footer
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text("Thank you for your purchase!", 105, 220, { align: "center" });
      doc.text("© ADULTFLIX - All Rights Reserved", 105, 226, { align: "center" });
    
      // Save the PDF
      doc.save(`ADULTFLIX-Receipt-${paymentData.videoTitle.replace(/\s+/g, '-')}.pdf`);
      setPdfGenerated(true);
      setTimeout(() => setPdfGenerated(false), 3000);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  // Create Telegram href for the button
  const telegramHref = (() => {
    if (!paymentData) return 'https://t.me/share/url';

    const encoded = encodeURIComponent(buildTelegramSupportMessage(paymentData));
    if (telegramUsername) {
      return `https://t.me/${telegramUsername.replace('@', '')}?text=${encoded}`;
    } else {
      return `https://t.me/share/url?text=${encoded}`;
    }
  })();

  const handleBack = () => {
    navigate('/videos');
  };

  const handleHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={handleBack}
            variant="outlined"
          >
            Back to Videos
          </Button>
          <Button 
            startIcon={<HomeIcon />} 
            onClick={handleHome}
            variant="contained"
          >
            Home
          </Button>
        </Box>
        
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!paymentData) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={handleBack}
            variant="outlined"
          >
            Back to Videos
          </Button>
          <Button 
            startIcon={<HomeIcon />} 
            onClick={handleHome}
            variant="contained"
          >
            Home
          </Button>
        </Box>
        
        <Alert severity="error">
          No payment data found.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={handleBack}
          variant="outlined"
        >
          Back to Videos
        </Button>
        <Button 
          startIcon={<HomeIcon />} 
          onClick={handleHome}
          variant="contained"
        >
          Home
        </Button>
      </Box>
      
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Success Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Payment Successful!
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Thank you for your purchase
          </Typography>
          {redirectCountdown !== null && redirectCountdown >= 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {isPayPalTelegramRedirect
                ? `Opening Telegram in ${redirectCountdown}s…`
                : `Redirecting you to your product in ${redirectCountdown}s...`}
            </Typography>
          )}
        </Box>

        {/* Payment Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            Purchase Details
          </Typography>
          
          <Box sx={{ 
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            p: 2,
            borderRadius: 1,
            mb: 2
          }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Video:</strong> {paymentData.videoTitle}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Price:</strong> ${paymentData.videoPrice.toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Payment Method:</strong> {paymentData.paymentMethod.toUpperCase()}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Transaction ID:</strong> {paymentData.transactionId}
            </Typography>
            <Typography variant="body1">
              <strong>Purchase Date:</strong> {formatPurchaseDate(new Date())}
            </Typography>
          </Box>
        </Box>

        {/* Product Link Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            Your Product Access
          </Typography>
          
          {paymentData.productLink ? (
            <Box>

              {/* Individual Links */}
              {getProductLinks().map((link, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Link {index + 1}:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        fullWidth
                        variant="outlined"
                        value={link.trim()}
                        InputProps={{
                          readOnly: true,
                          sx: { 
                            color: theme.palette.mode === 'dark' ? 'white' : theme.palette.text.primary,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        color={copiedLinkIndex === index ? ("success" as const) : ("primary" as const)}
                        onClick={() => copyIndividualLink(link, index)}
                        startIcon={copiedLinkIndex === index ? <CheckCircleIcon /> : <ContentCopyIcon />}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {copiedLinkIndex === index ? 'Copied!' : 'Copy'}
                      </Button>
                    </Box>
                    <Button
                      variant="outlined"
                      color="success"
                      fullWidth
                      onClick={() => window.open(link.trim(), '_blank', 'noopener,noreferrer')}
                      sx={{ 
                        borderColor: '#4caf50',
                        color: '#4caf50',
                        '&:hover': {
                          borderColor: '#4caf50',
                          background: '#4caf50',
                          color: 'white'
                        }
                      }}
                    >
                      🌐 Open Link {index + 1} in New Tab
                    </Button>
                  </Box>
                </Box>
              ))}

              {/* Copy All Links Button */}
              {getProductLinks().length > 1 && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={copyToClipboard}
                    startIcon={copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
                    sx={{ 
                      borderColor: theme => theme.palette.primary.main,
                      color: theme => theme.palette.primary.main,
                      '&:hover': {
                        borderColor: theme => theme.palette.primary.main,
                        color: '#fff',
                        background: theme => theme.palette.primary.main,
                      }
                    }}
                  >
                    {copied ? 'All Links Copied!' : 'Copy All Links'}
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              Your purchase was successful! The admin will need to update the product link. 
              Please contact support through Telegram for immediate access.
            </Alert>
          )}
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {paymentData.productLink && (
            <>
              {getProductLinks().map((link, index) => (
                <Button
                  key={index}
                  variant="contained"
                  color="success"
                  fullWidth
                  size="large"
                  onClick={() => window.open(link.trim(), '_blank', 'noopener,noreferrer')}
                  sx={{ py: 2, fontSize: '1.1rem', fontWeight: 'bold' }}
                >
                  🎬 Open Content {index + 1} of {getProductLinks().length}
                </Button>
              ))}
              
              <Button
                variant="contained"
                color={pdfGenerated ? "success" : "secondary"}
                fullWidth
                startIcon={pdfGenerated ? <CheckCircleIcon /> : <PictureAsPdfIcon />}
                onClick={generatePDF}
                sx={{ py: 1.5 }}
              >
                {pdfGenerated ? 'PDF Downloaded!' : 'Download Receipt PDF'}
              </Button>
            </>
          )}
          
          {telegramUsername && (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<TelegramIcon />}
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                borderColor: '#229ED9',
                color: '#229ED9',
                py: 1.5,
                '&:hover': {
                  borderColor: '#229ED9',
                  color: '#fff',
                  background: '#229ED9',
                }
              }}
            >
              Chat Telegram
            </Button>
          )}
        </Box>

        {/* Instructions */}
        <Box sx={{ mt: 4, p: 2, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ 
            color: theme.palette.mode === 'dark' ? '#aaa' : theme.palette.text.secondary,
            textAlign: 'center'
          }}>
            {paymentData.productLink 
              ? 'Please save your product link and download the receipt PDF. If any link does not work, please contact us via Telegram for immediate assistance.'
              : 'Your purchase has been recorded. Please contact support for access to your content.'}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentSuccess;