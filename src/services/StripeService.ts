// Kept as "StripeService" for backwards compatibility in the UI.
// Internally this now uses PayJSR checkout URLs.
export class StripeService {
  static async initStripe(_stripePublishableKey?: string): Promise<null> {
    return null;
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
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    try {
      const checkoutBase =
        import.meta.env.VITE_CHECKOUT_URL ||
        (import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || ''));

      const params = new URLSearchParams({
        amount: amount.toFixed(2),
        currency: String(currency || 'usd').toUpperCase(),
        success_url: successUrl,
        cancel_url: cancelUrl,
        product_name: productName,
        method: 'payjsr',
      });

      const checkoutUrl = `${checkoutBase}/api/paypal-checkout?${params.toString()}`;
      return {
        sessionId: 'masked_payjsr',
        checkoutUrl,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Redirect to Stripe checkout
   */
  static async redirectToCheckout(sessionIdOrCheckoutUrl: string): Promise<void> {
    if (!sessionIdOrCheckoutUrl) {
      throw new Error('Invalid checkout URL');
    }
    window.location.href = sessionIdOrCheckoutUrl;
  }
} 