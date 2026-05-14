import type { FC } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import AuthProvider from './services/Auth';
import { SiteConfigProvider, useSiteConfig } from './context/SiteConfigContext';
import Footer from './components/Footer';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Admin from './pages/Admin';
import Home from './pages/Home';
import PaymentSuccess from './pages/PaymentSuccess';
import Box from '@mui/material/Box';
import { useEffect, useState } from 'react';
import SplashAnimation from './components/SplashAnimation';
import PaymentNotifications from './components/PaymentNotifications';
import PrivacyNotice from './components/PrivacyNotice';
import ScrollToTop from './components/ScrollToTop';

// Componente AppContent para usar hooks que dependem do Router
const AppContent: FC = () => {
  const { siteName, loading } = useSiteConfig();
  const [showSplash, setShowSplash] = useState(false);
  const location = useLocation();
  const enableSplash = false; // feature-flag: disable splash animation
  
  // Atualizar o título da página quando o siteName mudar
  useEffect(() => {
    if (siteName) {
      document.title = `${siteName} - Adult Content`;
    }
  }, [siteName, location]);

  // Exibir a animação somente na primeira visita à página inicial
  useEffect(() => {
    if (!enableSplash) return;
    const isFirstVisit = !sessionStorage.getItem('visited');

    if (location.pathname === '/' && isFirstVisit) {
      setShowSplash(true);
      sessionStorage.setItem('visited', 'true');
    } else {
      setShowSplash(false);
    }
  }, [location.pathname, enableSplash]);

  // Função para marcar que a animação foi concluída
  const handleAnimationComplete = () => {
    setShowSplash(false);
  };

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>
      {enableSplash && showSplash && <SplashAnimation onAnimationComplete={handleAnimationComplete} />}
      <PrivacyNotice />
      <PaymentNotifications />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Box>
      <Footer />
    </Box>
  );
};

const App: FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <SiteConfigProvider>
            <AppContent />
          </SiteConfigProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
