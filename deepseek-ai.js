// deepseek-ai.js - Исправленный клиент для DeepSeek API
import axios from 'axios';

class DeepSeekAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // ИСПРАВЛЕНО: Правильный URL DeepSeek API
    this.baseURL = 'https://api.deepseek.com';
    this.model = 'deepseek-chat';
  }

  /**
   * Основной метод для общения
   */
  async chat(messages, options = {}) {
    try {
      console.log('🤖 Отправляем запрос в DeepSeek...');
      
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 800,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'CosmoDance-Bot/2.0'
          },
          timeout: 30000
        }
      );

      console.log('✅ Ответ получен от DeepSeek');
      
      return {
        content: response.data.choices[0]?.message?.content || "Извините, не могу ответить",
        usage: response.data.usage || {},
        model: response.data.model
      };

    } catch (error) {
      console.error('❌ Ошибка DeepSeek API:');
      
      if (error.response) {
        console.error('Статус:', error.response.status);
        console.error('Данные:', JSON.stringify(error.response.data));
      }
      console.error('Сообщение:', error.message);
      
      // Пользовательские ошибки
      if (error.response?.status === 401) {
        throw new Error('Ошибка авторизации. Проверьте API ключ DeepSeek.');
      } else if (error.response?.status === 429) {
        throw new Error('Превышен лимит запросов к DeepSeek. Попробуйте позже.');
      } else if (error.response?.status === 400) {
        throw new Error('Некорректный запрос к DeepSeek API.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Таймаут соединения с DeepSeek.');
      }
      
      throw new Error(`Ошибка DeepSeek API: ${error.message}`);
    }
  }
}

export default DeepSeekAI;
