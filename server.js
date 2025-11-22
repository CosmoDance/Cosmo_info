import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

// --- служебные переменные для ES-модулей ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // принимаем JSON до 10 МБ

// --- клиент OpenAI ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----- ГЛАВНАЯ СИСТЕМНАЯ ПОДСКАЗКА -----
const SYSTEM_PROMPT = `
Ты — дружелюбный ассистент студии танцев CosmoDance в Санкт-Петербурге.

Отвечай ТОЛЬКО по теме студии:
• направления, группы и уровни;
• филиалы, адреса, как пройти;
• расписание (общие принципы) и формат занятий;
• пробные занятия, абонементы, оплата, заморозка/продление;
• концерты, выступления, «дневник танцора» и особенности студии.

Если вопрос не относится к студии или к танцам — мягко ответь:
"Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."

Если нужно подключить администратора (сложные ситуации, деньги, точное расписание и т.п.), пиши в конце ответа:
"Пожалуйста, оставьте номер телефона, и администратор студии свяжется с вами."

Всегда:
• Обращайся на "вы".
• Пиши тёплым, поддерживающим тоном.
• Не придумывай факты, которых нет в базе: лучше честно скажи, что точную информацию уточнит администратор.
`;

// сюда кладём загруженную базу
let KNOWLEDGE_BASE = null;

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: преобразование базы в текст =====
function buildKnowledgeText() {
  if (!KNOWLEDGE_BASE) return "";

  try {
    // 1) формат { docs: [ { title, text }, ... ] }
    if (KNOWLEDGE_BASE.docs && Array.isArray(KNOWLEDGE_BASE.docs)) {
      const docs = KNOWLEDGE_BASE.docs;
      const textBlocks = docs.map((doc, i) => {
        const title = doc.title || `Раздел ${i + 1}`;
        const body = doc.text || doc.content || "";
        return `${title}:\n${body}`;
      });
      return (
        "\n\nВот подробные материалы о студии CosmoDance. Используй их, отвечая максимально точно:\n\n" +
        textBlocks.join("\n\n")
      );
    }

    // 2) формат { items: [ { question, answer }, ... ] }
    if (KNOWLEDGE_BASE.items && Array.isArray(KNOWLEDGE_BASE.items)) {
      const items = KNOWLEDGE_BASE.items;
      const qaBlocks = items.map((item, i) => {
        const q = item.question || item.q || "";
        const a = item.answer || item.a || "";
        return `Q${i + 1}: ${q}\nA${i + 1}: ${a}`;
      });
      return (
        "\n\nВот база вопросов и ответов по CosmoDance, используй их дословно там, где это уместно:\n\n" +
        qaBlocks.join("\n\n")
      );
    }

    // 3) массив документов или Q/A: [ {...}, {...} ]
    if (Array.isArray(KNOWLEDGE_BASE)) {
      // пробуем понять, это больше похоже на документы или Q/A
      const looksLikeQA = KNOWLEDGE_BASE.every(
        (item) =>
          typeof item === "object" &&
          (item.question || item.q || item.answer || item.a)
      );

      if (looksLikeQA) {
        const qaBlocks = KNOWLEDGE_BASE.map((item, i) => {
          const q = item.question || item.q || "";
          const a = item.answer || item.a || "";
          return `Q${i + 1}: ${q}\nA${i + 1}: ${a}`;
        });
        return (
          "\n\nВот база вопросов и ответов по CosmoDance, используй их дословно там, где это уместно:\n\n" +
          qaBlocks.join("\n\n")
        );
      } else {
        // считаем, что это документы { title, text }
        const docBlocks = KNOWLEDGE_BASE.map((doc, i) => {
          if (!doc || typeof doc !== "object") return "";
          const title = doc.title || doc.name || `Раздел ${i + 1}`;
          const body = doc.text || doc.content || "";
          return `${title}:\n${body}`;
        });
        return (
          "\n\nВот материалы о студии CosmoDance. Используй их как основную правду о студии:\n\n" +
          docBlocks.join("\n\n")
        );
      }
    }

    // 4) fallback — если формат нестандартный
    return (
      "\n\nВ объекте KNOWLEDGE_BASE есть данные о студии CosmoDance. " +
      "Отвечай по студии и не выдумывай, если не уверен."
    );
  } catch (err) {
    console.error("Ошибка при сборке текста базы знаний:", err);
    return "";
  }
}

// ===== ОТДАТЬ ВЕБ-СТРАНИЦУ ЧАТА =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// ===== ПРИНЯТЬ БАЗУ ЗНАНИЙ ОТ upload.js =====
app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res
        .status(400)
        .json({ status: "error", message: "Пустое тело запроса" });
    }

    KNOWLEDGE_BASE = body;

    let count = null;
    if (Array.isArray(body)) {
      count = body.length;
    } else if (body.docs && Array.isArray(body.docs)) {
      count = body.docs.length;
    } else if (body.items && Array.isArray(body.items)) {
      count = body.items.length;
    }

    console.log("База знаний обновлена, записей:", count ?? "неизвестно");

    res.json({
      status: "ok",
      message: "База принята на сервере",
      count,
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res
      .status(500)
      .json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// ===== ОСНОВНОЙ ЧАТ =====
app.post("/chat", async (req, res) => {
  try {
    const { userMessage } = req.body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return res.json({
        reply: "Пожалуйста, напишите ваш вопрос о студии CosmoDance.",
      });
    }

    const knowledgeText = buildKnowledgeText();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + knowledgeText,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте переформулировать вопрос или спросите что-то ещё о студии.";

    res.json({ reply });
  } catch (error) {
    console.error("Ошибка в /chat:", error);
    res.status(500).json({
      reply:
        "Извините, сейчас у меня техническая пауза. Попробуйте задать вопрос чуть позже или оставьте номер телефона — администратор свяжется с вами.",
    });
  }
});

// ===== ЗАПУСК СЕРВЕРА =====
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
