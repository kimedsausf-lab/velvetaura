/**
 * PayJSR checkout is optional. Show the button only when:
 * - `VITE_PAYJSR_ENABLED=true` (chave só no servidor, ex.: PAYJSR_SECRET_KEY no Render), ou
 * - existe secret guardado no site config (Supabase / admin — campo usado como PayJSR secret).
 */
export function isPayJsrCheckoutAvailable(stripeSecretKeyFromSiteConfig: string): boolean {
  const flag = String(import.meta.env.VITE_PAYJSR_ENABLED || '').toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  return Boolean(stripeSecretKeyFromSiteConfig && String(stripeSecretKeyFromSiteConfig).trim());
}
