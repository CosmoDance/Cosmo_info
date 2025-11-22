import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // принимаем JSON до 2 МБ

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----- ГЛАВНАЯ СИСТЕМНАЯ ПОДСКАЗКА -----
const SYSTEM_PROMPT = `
Ты — дружелюбный ассистент студии танцев CosmoDance.
Отвечай ТОЛЬКО по теме студии: направления, филиалы, расписание, цены, пробные занятия,
акции, правила студии, особенности обучения и т.п.

Если вопрос не относится к студии или к танцам — мягко перенаправляй:
"Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."

Если нужно подключить администратора, пиши:
"Пожалуйста, оставьте номер телефона, и администратор свяжется с вами."

Отвечай на ВЫ, тепло, уверенно, простым человеческим языком.
`;

// сюда будем складывать загруженную базу
let KNOWLEDGE_BASE = null;

// ----- ОТДАТЬ ВЕБ-СТРАНИЦУ ЧАТА -----
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// ----- ПРИНЯТЬ БАЗУ ЗНАНИЙ ОТ upload.js -----
app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ status: "error", message: "Пустое тело запроса" });
    }

    KNOWLEDGE_BASE = body;
    let count = null;

    if (Array.isArray(body)) {
      count = body.length;
    } else if (body.items && Array.isArray(body.items)) {
      count = body.items.length;
    }

    console.log("База знаний обновлена, записей:", count ?? "неизвестно");
    res.json({ status: "ok", message: "База принята на сервере", count });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res.status(500).json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// ----- ОСНОВНОЙ ЧАТ -----
app.post("/chat", async (req, res) => {
  try {
    const { userMessage } = req.body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос.",
      });
    }

    // превращаем базу в текстовый контекст для модели
    let knowledgeText = "";
    if (KNOWLEDGE_BASE) {
      if (Array.isArray(KNOWLEDGE_BASE)) {
        knowledgeText =
          "\n\nВот база знаний CosmoDance (вопросы и ответы, используй их точно):\n" +
          KNOWLEDGE_BASE.map(
            (item, i) =>
              `Q${i + 1}: ${item.question || item.q || ""}\nA${i + 1}: ${item.answer || item.a || ""}`
          ).join("\n\n");
      } else if (KNOWLEDGE_BASE.items && Array.isArray(KNOWLEDGE_BASE.items)) {
        const items = KNOWLEDGE_BASE.items;
        knowledgeText =
          "\n\nВот база знаний CosmoDance (вопросы и ответы, используй их точно):\n" +
          items
            .map(
              (item, i) =>
                `Q${i + 1}: ${item.question || item.q || ""}\nA${i + 1}: ${item.answer || item.a || ""}`
            )
            .join("\n\n");
      }
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + knowledgeText },
        { role: "user", content: userMessage },
      ],
      temperature: 0.6,
      max_tokens: 700,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте переформулировать вопрос.";

    res.json({ reply });
  } catch (error) {
    console.error("Ошибка в /chat:", error);
    res.status(500).json({
      reply:
        "Извините, сейчас у меня техническая пауза. Попробуйте задать вопрос чуть позже или свяжитесь с администратором студии.",
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
