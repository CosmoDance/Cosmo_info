// server.js
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

// Берём ключ из переменных окружения (в Render в разделе Environment)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
app.use(bodyParser.json());

// Простой эндпоинт для проверки, что сервер живой
app.get('/', (req, res) => {
  res.send('Cosmo ChatBot server is running');
});

// Основной эндпоинт для чата
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: 'Нет текста сообщения (message)' });
    }

    const reply = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ВАЖНО: здесь шаблонная строка с обратными кавычками `
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Ты чат-бот студии танцев CosmoDance (cosmo.su). ' +
              'Отвечай по-русски, дружелюбно, коротко и по делу. ' +
              'Если вопрос не по теме танцев и студии, отвечай, но мягко ' +
              'возвращай человека к теме танцев и занятий в CosmoDance.',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
      }),
    });

    const data = await reply.json();

    // Пытаемся достать ответ модели
    const answer =
      data?.choices?.[0]?.message?.content ||
      'Извини, не удалось получить ответ от модели. Попробуй ещё раз.';

    res.json({ answer });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Порт для Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cosmo chatbot server is running on port ${PORT}`);
});
