// deepseek-ai.js - Простой клиент для DeepSeek API
import axios from 'axios';

class DeepSeekAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
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
          messages: this.formatMessages(messages),
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 800,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('✅ Ответ получен от DeepSeek');
      
      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        model: response.data.model
      };

    } catch (error) {
      console.error('❌ Ошибка DeepSeek:', error.response?.data || error.message);
      
      // Пользовательские ошибки
      if (error.response?.status === 401) {
        throw new Error('Неверный API ключ DeepSeek');
      } else if (error.response?.status === 429) {
        throw new Error('Превышен лимит запросов к DeepSeek');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Таймаут соединения с DeepSeek');
      }
      
      throw new Error(`DeepSeek API ошибка: ${error.message}`);
    }
  }

  /**
   * Форматируем сообщения для DeepSeek
   */
  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
}

export default DeepSeekAI;
