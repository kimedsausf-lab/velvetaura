import { TELEGRAM_CONFIG } from '../config/telegram';

interface TelegramNotification {
  videoTitle: string;
  videoPrice: number;
  buyerEmail?: string;
  buyerName?: string;
  transactionId: string;
  paymentMethod: 'paypal' | 'stripe' | 'crypto' | 'who';
  timestamp: string;
}


class TelegramService {
  private static readonly BOT_TOKEN = TELEGRAM_CONFIG.BOT_TOKEN;
  private static readonly CHAT_ID = TELEGRAM_CONFIG.CHAT_ID;
  private static readonly API_URL = TELEGRAM_CONFIG.API_URL;

  /**
   * Envia notificação de venda para o Telegram
   */
  static async sendSaleNotification(notification: TelegramNotification): Promise<boolean> {
    try {
      const message = this.formatSaleMessage(notification);
      
      const response = await fetch(`${this.API_URL}${this.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao enviar mensagem para Telegram:', errorData);
        return false;
      }

      console.log('Notificação enviada para Telegram com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao enviar notificação para Telegram:', error);
      return false;
    }
  }

  /**
   * Formata a mensagem de venda para o Telegram
   */
  private static formatSaleMessage(notification: TelegramNotification): string {
    const emoji = notification.paymentMethod === 'paypal' ? '💳' : 
                  notification.paymentMethod === 'stripe' ? '💳' : '₿';
    
    const methodName = notification.paymentMethod === 'paypal' ? 'PayPal' :
                      notification.paymentMethod === 'stripe' ? 'Stripe (Apple Pay, Amazon Pay, Visa, Mastercard)' : 'Crypto';

    return `
🛒 <b>NOVA VENDA REALIZADA!</b> ${emoji}

📹 <b>Vídeo:</b> ${notification.videoTitle}
💰 <b>Valor:</b> $${notification.videoPrice.toFixed(2)}
💳 <b>Método:</b> ${methodName}
🆔 <b>Transação:</b> <code>${notification.transactionId}</code>
⏰ <b>Data:</b> ${notification.timestamp}

${notification.buyerEmail ? `👤 <b>Email:</b> ${notification.buyerEmail}` : ''}
${notification.buyerName ? `👤 <b>Nome:</b> ${notification.buyerName}` : ''}

✅ <b>Status:</b> Pagamento confirmado
    `.trim();
  }

  /**
   * Envia notificação de erro para o Telegram
   */
  static async sendErrorNotification(error: string, context?: string): Promise<boolean> {
    try {
      const message = `
🚨 <b>ERRO NO SISTEMA</b>

${context ? `<b>Contexto:</b> ${context}` : ''}
<b>Erro:</b> <code>${error}</code>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
      `.trim();

      const response = await fetch(`${this.API_URL}${this.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Erro ao enviar notificação de erro para Telegram:', error);
      return false;
    }
  }




  /**
   * Testa a conexão com o bot
   */
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_URL}${this.BOT_TOKEN}/getMe`);
      const data = await response.json();
      
      if (data.ok) {
        console.log('Bot conectado:', data.result.first_name);
        return true;
      } else {
        console.error('Erro na conexão com bot:', data);
        return false;
      }
    } catch (error) {
      console.error('Erro ao testar conexão com bot:', error);
      return false;
    }
  }
}

export default TelegramService;
