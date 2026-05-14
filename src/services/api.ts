/**
 * API routes for the application
 */

import { useSiteConfig } from '../context/SiteConfigContext';
import { jsonDatabaseService } from './JSONDatabaseService';

// Base API URL - configurado para desenvolvimento local ou produção
const isDev = import.meta.env.DEV;

// Função para detectar automaticamente a URL da API baseada no domínio atual
const getApiBaseUrl = () => {
  if (isDev) {
    return ''; // URL relativa: pedidos vão para o mesmo origin e o Vite faz proxy para o backend
  }
  
  // Se VITE_API_URL estiver configurado, use ele
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Caso contrário, use o domínio atual como base para a API
  const currentOrigin = window.location.origin;
  return currentOrigin;
};

const API_BASE_URL = getApiBaseUrl();

// Helper function to get Stripe secret key from JSON database
export const getStripeSecretKey = async (): Promise<string> => {
  try {
    const config = await jsonDatabaseService.getSiteConfig();
    
    if (config) {
      return config.stripeSecretKey || '';
    }
    return '';
  } catch (error) {
    console.error('Error fetching Stripe secret key from JSON database:', error);
    throw error;
  }
};

/**
 * Create a PayJSR checkout session
 */
export const createStripeCheckoutSession = async (
  amount: number, 
  currency: string = 'usd',
  productName: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; checkoutUrl: string }> => {
  console.log('Creating PayJSR checkout session:', {
    amount: Math.round(amount * 100),
    currency,
    name: productName,
    success_url: successUrl,
    cancel_url: cancelUrl,
    apiUrl: API_BASE_URL
  });
  
  const fullUrl = `${API_BASE_URL}/api/create-checkout-session`;
  console.log('Making request to:', fullUrl);
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      name: productName,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Failed to create PayJSR checkout session:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url: fullUrl
    });
    throw new Error(`Failed to create PayJSR checkout session: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get PayPal Client ID from API
 */
export const getPayPalClientId = async (): Promise<string> => {
  const fullUrl = `${API_BASE_URL}/api/paypal-client-id`;
  
  const response = await fetch(fullUrl);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Failed to get PayPal Client ID:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url: fullUrl
    });
    throw new Error(`Failed to get PayPal Client ID: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.clientId;
}; 