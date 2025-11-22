import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

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

// --- карты для дней недели ---
const DAY_FULL = {
  "Пн": "Понедельник",
  "Вт": "Вторник",
  "Ср": "Среда",
  "Чт": "Четверг",
  "Пт": "Пятница",
  "Сб": "Суббота",
  "Вс": "Воскресенье",
};

// ----- ГЛАВНАЯ СИСТЕМНАЯ ПОДСКАЗКА -----
const SYSTEM_PROMPT_BASE = `
Ты — дружелюбный ассистент студии танцев CosmoDance.

Твоя задача:
- помочь выбрать направление (для взрослого или ребёнка);
- учесть возраст ребёнка и танцевальный опыт (новичок / есть опыт);
- подобрать подходящую группу по расписанию, которое дано в базе;
- подсказать адрес и контакты филиала;
- рассказать про пробные занятия, абонементы, особенности обучения.

ВАЖНО:
1. Отвечай ТОЛЬКО по теме студии CosmoDance.
2. Пользователь может в ОДНОЙ фразе дать сразу несколько ответов:
   пример: "5 лет звёздная", "девочка 7 лет, Дыбенко, только начинаем".
   Ты обязан вытащить из фразы:
   - возраст,
   - филиал,
   - есть ли танцевальный опыт (новичок или нет),
   - для кого занятия (если понятно из контекста).
   Если эти данные уже были названы ранее в диалоге, не спрашивай их снова.
3. Групповые занятия проходят строго по расписанию групп.
   Не предлагай "любое время": всегда опирайся на расписание.
4. Индивидуальные занятия можно согласовать по времени с тренером.
5. Если вопрос не относится к студии или к танцам — мягко перенаправь:
   "Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."
6. Если нужно подключить администратора, пиши:
   "Пожалуйста, оставьте номер телефона, и администратор свяжется с вами."
7. Отвечай на ВЫ, тепло, уверенно, простым человеческим языком.
`;

// сюда будем складывать загруженную базу
let KNOWLEDGE_BASE = null;         // текстовые Q&A
let SCHEDULE_DATA = null;         // расписание всех филиалов
let SCHEDULE_TEXT = "";           // готовый текст для подсказки

function buildScheduleText(data) {
  if (!data || !Array.isArray(data.groups) || data.groups.length === 0) {
    return "";
  }

  const parts = [];
  parts.push("\n\nНиже подробное расписание групп CosmoDance по филиалам. Используй это как источник правды для дней недели и времени занятий.\n");

  for (const group of data.groups) {
    const branch = group.branch || "Филиал";
    const name = group.group_name || "Группа";
    const teacher = group.teacher ? `, педагог: ${group.teacher}` : "";
    const level = group.level ? `, уровень: ${group.level}` : "";
    const isTeam = group.is_team ? " (команда, по отбору)" : "";

    let scheduleStr = "";
    if (group.schedule && typeof group.schedule === "object") {
      const dayParts = [];
      for (const [shortDay, time] of Object.entries(group.schedule)) {
        if (!time) continue;
        const fullDay = DAY_FULL[shortDay] || shortDay;
        dayParts.push(`${fullDay}: ${time}`);
      }
      if (dayParts.length > 0) {
        scheduleStr = " Расписание: " + dayParts.join("; ") + ".";
      }
    }

    parts.push(
      `Филиал: ${branch}. Группа: ${name}${level}${isTeam}${teacher}.${scheduleStr}`
    );
  }

  return parts.join("\n");
}

// при запуске попробуем сразу прочитать расписание с диска (на случай, если оно лежит рядом)
const schedulePath = path.join(__dirname, "cosmo_schedule_all_branches_ready.json");
if (fs.existsSync(schedulePath)) {
  try {
    const raw = fs.readFileSync(schedulePath, "utf-8");
    SCHEDULE_DATA = JSON.parse(raw);
    SCHEDULE_TEXT = buildScheduleText(SCHEDULE_DATA);
    console.log("Локальное расписание загружено, групп:", SCHEDULE_DATA.groups?.length ?? 0);
  } catch (e) {
    console.error("Не удалось прочитать локальное расписание:", e);
  }
}

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

    // Вариант 1: пришёл объект { knowledge, schedule }
    if (body.knowledge || body.schedule) {
      KNOWLEDGE_BASE = body.knowledge || null;
      SCHEDULE_DATA = body.schedule || SCHEDULE_DATA;
    }
    // Вариант 2: пришёл просто массив Q&A (старый формат)
    else if (Array.isArray(body)) {
      KNOWLEDGE_BASE = body;
    } else {
      KNOWLEDGE_BASE = body;
    }

    if (SCHEDULE_DATA) {
      SCHEDULE_TEXT = buildScheduleText(SCHEDULE_DATA);
    }

    let countKnowledge = null;
    if (Array.isArray(KNOWLEDGE_BASE)) {
      countKnowledge = KNOWLEDGE_BASE.length;
    } else if (KNOWLEDGE_BASE?.items && Array.isArray(KNOWLEDGE_BASE.items)) {
      countKnowledge = KNOWLEDGE_BASE.items.length;
    }

    let countSchedule = null;
    if (SCHEDULE_DATA?.groups && Array.isArray(SCHEDULE_DATA.groups)) {
      countSchedule = SCHEDULE_DATA.groups.length;
    }

    console.log("База знаний обновлена. Q&A:", countKnowledge ?? "?", "групп по расписанию:", countSchedule ?? "?");

    res.json({
      status: "ok",
      message: "База принята на сервере",
      countKnowledge,
      countSchedule,
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res.status(500).json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// ----- ОСНОВНОЙ ЧАТ -----
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос.",
      });
    }

    // превращаем базу Q&A в текстовый контекст для модели
    let knowledgeText = "";
    if (KNOWLEDGE_BASE) {
      let items = [];
      if (Array.isArray(KNOWLEDGE_BASE)) {
        items = KNOWLEDGE_BASE;
      } else if (KNOWLEDGE_BASE.items && Array.isArray(KNOWLEDGE_BASE.items)) {
        items = KNOWLEDGE_BASE.items;
      }

      if (items.length > 0) {
        knowledgeText =
          "\n\nВот база знаний CosmoDance (вопросы и ответы, используй их как источник достоверной информации):\n" +
          items
            .map(
              (item, i) =>
                `Q${i + 1}: ${item.question || item.q || ""}\nA${i + 1}: ${item.answer || item.a || ""}`
            )
            .join("\n\n");
      }
    }

    const systemContent = SYSTEM_PROMPT_BASE + knowledgeText + SCHEDULE_TEXT;

    const openaiMessages = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: openaiMessages,
      temperature: 0.5,
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
