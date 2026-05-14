import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/Auth';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthenticated, checkSession, sessionCheckedAt } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const location = useLocation();

  // Verify session on mount and whenever location changes
  useEffect(() => {
    let isMounted = true;
    
    const verifySession = async () => {
      if (!isMounted) return;
      
      setIsVerifying(true);
      setVerificationError(null);
      
      try {
        // Only check session if it hasn't been checked recently
        const now = Date.now();
        if (now - sessionCheckedAt > 10000) { // 10 seconds
          await checkSession();
        }
      } catch (err) {
        console.error('Error verifying session:', err);
        if (isMounted) {
          setVerificationError('Erro ao verificar autenticação. Por favor, faça login novamente.');
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    };

    verifySession();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [location.pathname, checkSession, sessionCheckedAt]);

  // Show loading indicator while checking authentication
  if (loading || isVerifying) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress size={40} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verificando autenticação...
        </Typography>
      </Box>
    );
  }
  
  // Show error if verification failed
  if (verificationError) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        p: 2
      }}>
        <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 500 }}>
          {verificationError}
        </Alert>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => {
            localStorage.removeItem('sessionToken');
            window.location.href = '/login';
          }}
        >
          Ir para login
        </Button>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!user || !isAuthenticated) {
    // Save the location user was trying to access for redirect after login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Render children if authenticated
  return <>{children}</>;
};

export default ProtectedRoute; 