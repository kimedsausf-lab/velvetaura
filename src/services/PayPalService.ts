import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { getPayPalClientId } from './api';

// Helper class for PayPal integration
export class PayPalService {
  /**
   * Get PayPal client ID from configuration
   */
  static async getPayPalClientId(): Promise<string> {
    try {
      return await getPayPalClientId();
    } catch (error) {
      console.error('Error fetching PayPal client ID:', error);
      return '';
    }
  }
}

// Export PayPal components for use in React components
export { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer };
