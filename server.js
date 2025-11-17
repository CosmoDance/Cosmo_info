// server.js

import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Берём ключ из переменной окружения OPENAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("⚠️ Переменная окружения OPENAI_API_KEY не задана.");
}

// Простой health-чек, чтобы Render видел, что сервер жив
app.get("/", (req, res) => {
  res.send("CosmoDance bot backend is running ✅");
});

// Основной эндпоинт для чат-бота
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Поле 'message' обязательно" });
    }

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content:
                "Ты — чат-бот студии танцев CosmoDance (cosmo.su) в Санкт-Петербурге. " +
                "Отвечай на вопросы про расписание, направления, возрастные группы, " +
                "филиалы, абонементы и организацию занятий. Пиши дружелюбно, по-русски, " +
                "кратко и по делу. Если чего-то не знаешь точно, предложи оставить номер " +
                "телефона или написать администратору.",
            },
            { role: "user", content: userMessage },
          ],
        }),
      }
    );

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", data);
      return res
        .status(500)
        .json({ error: "Ошибка обращения к OpenAI", details: data });
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "Извини, я не смог сформировать ответ, попробуй ещё раз.";

    return res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// Порт, который задаёт Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 CosmoDance bot server запущен на порту ${PORT}`);
});
