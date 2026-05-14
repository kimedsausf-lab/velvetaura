// Configurações do Telegram Bot
// Para obter essas credenciais:
// 1. Crie um bot no @BotFather no Telegram
// 2. Use o comando /newbot e siga as instruções
// 3. Copie o token do bot
// 4. Para obter o CHAT_ID, envie uma mensagem para o bot e acesse:
//    https://api.telegram.org/bot<SEU_BOT_TOKEN>/getUpdates

export const TELEGRAM_CONFIG = {
  // Token do bot (obtenha no @BotFather)
  BOT_TOKEN: '8216788918:AAG-0M8I-nkKDxB8DtWh2_GjS_GMqbMWBIU',
  
  // ID do chat onde as notificações serão enviadas
  // Pode ser seu ID pessoal ou ID de um grupo
  CHAT_ID: '7854949857',
  
  // URL base da API do Telegram
  API_URL: 'https://api.telegram.org/bot'
};

// Instruções para configurar:
// 1. Substitua 'YOUR_BOT_TOKEN_HERE' pelo token do seu bot
// 2. Substitua 'YOUR_CHAT_ID_HERE' pelo ID do chat onde quer receber as notificações
// 3. Para obter o CHAT_ID:
//    - Envie uma mensagem para o bot
//    - Acesse: https://api.telegram.org/bot<SEU_BOT_TOKEN>/getUpdates
//    - Procure por "chat":{"id": e copie o número
