// Helper class for Whop payment integration
export class WhoService {
  private static apiKey: string | null = null;

  /**
   * Initialize Whop with the given API key
   */
  static initWho(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Create a checkout session for a product
   */
  static async createCheckoutSession(
    amount: number,
    currency: string = 'usd',
    productName: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Whop API key not initialized');
      }

      const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const response = await fetch(`${API_BASE_URL}/api/create-who-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          product_name: productName,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      // Whop retorna: { sessionId, checkout_url }
      return data.checkout_url || data.sessionId; // checkout_url é a URL completa
    } catch (error) {
      console.error('Error creating Whop checkout session:', error);
      throw error;
    }
  }

  /**
   * Redirect to Whop checkout
   */
  static async redirectToCheckout(sessionIdOrUrl: string): Promise<void> {
    try {
      // Whop retorna a URL completa (purchase_url) diretamente
      // Se for uma URL, redireciona diretamente
      if (sessionIdOrUrl.startsWith('http')) {
        window.location.href = sessionIdOrUrl;
        return;
      }

      // Fallback: se for apenas um session ID, constrói a URL
      // (não deveria acontecer, mas por segurança)
      const checkoutUrl = `https://whop.com/checkout/?session=${sessionIdOrUrl}`;
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error redirecting to Whop checkout:', error);
      throw error;
    }
  }
}

