// deepseek-ai.js - Бесплатный AI для CosmoDance
import axios from 'axios';

class DeepSeekAI {
  constructor(apiKey, baseURL = 'https://api.deepseek.com') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.model = 'deepseek-chat';
    this.contextLength = 16000; // токенов
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
          max_tokens: options.maxTokens || 1000,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000 // 30 секунд
        }
      );

      console.log('✅ Ответ получен от DeepSeek');
      
      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        model: response.data.model
      };

    } catch (error) {
      console.error('❌ Ошибка DeepSeek:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      throw new Error(`DeepSeek API ошибка: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Форматируем сообщения для DeepSeek
   */
  formatMessages(messages) {
    return messages.map(msg => {
      // DeepSeek принимает system/user/assistant
      let role = msg.role;
      
      // Если роль system, оставляем как есть (DeepSeek поддерживает)
      if (role === 'system') {
        return { role: 'system', content: msg.content };
      }
      
      // user и assistant остаются без изменений
      return { role: role, content: msg.content };
    });
  }

  /**
   * Быстрый ответ (упрощенный)
   */
  async quickAnswer(prompt, context = '') {
    const messages = [
      {
        role: 'system',
        content: `Ты ассистент студии танцев CosmoDance. ${context}`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const result = await this.chat(messages);
    return result.content;
  }

  /**
   * Проверка доступности API
   */
  async checkHealth() {
    try {
      await axios.get(`${this.baseURL}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 5000
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default DeepSeekAI;
