// server.js
// Полностью готовый вариант

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Базовая настройка сервера ----------

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // принимаем JSON до 2 МБ

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Загрузка локальных файлов (knowledge + расписание) ----------

let KNOWLEDGE_BASE = null; // то, что ты заливаешь через upload.js
let SCHEDULE = null;       // cosmo_schedule_all_branches_ready.json

async function loadLocalData() {
  // knowledge.json
  try {
    const kbPath = path.join(__dirname, "knowledge.json");
    const kbRaw = await fs.readFile(kbPath, "utf-8");
    KNOWLEDGE_BASE = JSON.parse(kbRaw);
    console.log("✅ knowledge.json загружен");
  } catch (e) {
    console.warn("⚠️ Не удалось загрузить knowledge.json:", e.message);
  }

  // расписание
  try {
    const schedulePath = path.join(
      __dirname,
      "cosmo_schedule_all_branches_ready.json"
    );
    const schedRaw = await fs.readFile(schedulePath, "utf-8");
    SCHEDULE = JSON.parse(schedRaw);
    console.log("✅ Файл расписания загружен");
  } catch (e) {
    console.warn(
      "⚠️ Не удалось загрузить cosmo_schedule_all_branches_ready.json:",
      e.message
    );
  }
}

loadLocalData();

// ---------- Хранение сессий (история диалога) ----------

/**
 * SESSIONS: {
 *   [sessionId]: {
 *      messages: [{role: "user"|"assistant", content: string}],
 *      lastActivity: number (Date.now()),
 *      finished: boolean
 *   }
 * }
 */
const SESSIONS = new Map();
const INACTIVITY_MINUTES = 10;

function getSession(sessionId) {
  let session = SESSIONS.get(sessionId);
  if (!session) {
    session = {
      messages: [],
      lastActivity: Date.now(),
      finished: false,
    };
    SESSIONS.set(sessionId, session);
  }
  return session;
}

function cleanOldSessions() {
  const now = Date.now();
  for (const [id, session] of SESSIONS) {
    if (now - session.lastActivity > INACTIVITY_MINUTES * 60 * 1000) {
      SESSIONS.delete(id);
    }
  }
}

// чистим старые сессии раз в 5 минут
setInterval(cleanOldSessions, 5 * 60 * 1000);

// ---------- Построение системного промпта ----------

function buildSystemPrompt() {
  let prompt = `
Ты — дружелюбный онлайн-ассистент студии танцев CosmoDance.

Твои задачи:
- помогать выбрать филиал, направление и группу;
- подсказывать расписание и абонементы;
- объяснять условия пробного занятия;
- поддерживать и мотивировать, но не давить.

Важные правила:
- Отвечай ТОЛЬКО по теме студии CosmoDance и танцев.
- Всегда учитывай предыдущие ответы человека в ЭТОМ диалоге (филиал, возраст, опыт, цели и т.п.).
- Не задавай один и тот же вопрос по несколько раз, если уже получил понятный ответ.
- Пиши на «вы», дружелюбно и простым человеческим языком.
- Если вопрос не по теме студии — мягко скажи, что отвечаешь только по студии, и предложи задать другой вопрос.
`;

  if (SCHEDULE && Array.isArray(SCHEDULE.groups)) {
    prompt += `
У тебя есть структурированное расписание групп CosmoDance (разные филиалы, группы, дни недели и время).
Если видишь, что человек спрашивает про расписание или хочет подобрать группу,
используй эти данные, чтобы предлагать реальные варианты занятий.

Если возраст группы написан как "16+", это означает "от 16 и старше" — взрослым любого возраста туда можно,
кроме очень пожилых людей (60+), которым лучше предложить более мягкие направления (зумба, латина и т.п.).
`;
  }

  return prompt.trim();
}

// превратить KNOWLEDGE_BASE в текст для промпта
function knowledgeToText() {
  if (!KNOWLEDGE_BASE) return "";

  if (Array.isArray(KNOWLEDGE_BASE.items)) {
    return (
      "\n\nДополнительная база вопросов и ответов по студии:\n" +
      KNOWLEDGE_BASE.items
        .map(
          (item, i) =>
            `Q${i + 1}: ${item.question || ""}\nA${i + 1}: ${
              item.answer || ""
            }`
        )
        .join("\n\n")
    );
  }

  if (Array.isArray(KNOWLEDGE_BASE)) {
    return (
      "\n\nДополнительная база вопросов и ответов по студии:\n" +
      KNOWLEDGE_BASE.map(
        (item, i) =>
          `Q${i + 1}: ${item.question || ""}\nA${i + 1}: ${item.answer || ""}`
      ).join("\n\n")
    );
  }

  return "";
}

// ---------- Отправка отчёта в Telegram (после завершения диалога) ----------

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;      // твой бот
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID; // id @denvertop или общего чата

async function sendDialogSummaryToTelegram(sessionId, dialogMessages) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return; // если не настроено — тихо выходим

  // Сформируем краткое резюме диалога через OpenAI
  let summaryText;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Сделай короткий отчёт о диалоге между клиентом и студией танцев. Важное: филиал, возраст, опыт, цель, выбранное направление/группа/расписание, договорились ли о пробном, есть ли телефон.",
        },
        {
          role: "user",
          content:
            "Вот история диалога:\n\n" +
            dialogMessages
              .map((m) =>
                m.role === "user"
                  ? `КЛИЕНТ: ${m.content}`
                  : `БОТ: ${m.content}`
              )
              .join("\n"),
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    summaryText = completion.choices?.[0]?.message?.content?.trim();
  } catch (e) {
    console.error("Ошибка при суммаризации диалога:", e);
    summaryText = null;
  }

  const text =
    (summaryText || "Не удалось автоматически сделать отчёт по диалогу.") +
    `\n\nID сессии: ${sessionId}`;

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
      }),
    });
  } catch (e) {
    console.error("Ошибка отправки отчёта в Telegram:", e);
  }
}

// ---------- Маршруты ----------

// отдать страницу чата
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// принять базу знаний (upload.js шлёт сюда knowledge.json)
app.post("/upload", (req, res) => {
  try {
    KNOWLEDGE_BASE = req.body;
    console.log("✅ База знаний обновлена через /upload");
    return res.json({
      status: "ok",
      message: "База знаний обновлена на сервере",
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    // Важно: даже при ошибке отдаём 200, чтобы не было красной ошибки на фронте
    return res.status(200).json({
      status: "error",
      message: "Не удалось сохранить базу знаний на сервере.",
    });
  }
});

// основной чат
app.post("/chat", async (req, res) => {
  try {
    const { sessionId, userMessage } = req.body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(200).json({
        reply: "Пожалуйста, напишите ваш вопрос о студии CosmoDance 🙂",
      });
    }

    // Если фронт не прислал sessionId — привяжем к ip (на всякий случай)
    const sid = sessionId || "anon-" + (req.ip || "unknown");

    const session = getSession(sid);
    session.lastActivity = Date.now();
    session.finished = false;

    // добавляем сообщение пользователя в историю
    session.messages.push({ role: "user", content: userMessage });

    // ограничим длину истории, чтобы она не разрасталась бесконечно
    if (session.messages.length > 40) {
      session.messages = session.messages.slice(-40);
    }

    const systemPrompt = buildSystemPrompt() + knowledgeToText();

    const messagesForModel = [
      { role: "system", content: systemPrompt },
      ...session.messages,
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesForModel,
      temperature: 0.5,
      max_tokens: 700,
    });

    const replyText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте переформулировать вопрос.";

    // сохраняем ответ ассистента
    session.messages.push({ role: "assistant", content: replyText });

    return res.status(200).json({
      reply: replyText,
      sessionId: sid,
    });
  } catch (error) {
    console.error("Ошибка в /chat:", error);

    // КРИТИЧЕСКИЙ МОМЕНТ:
    // Возвращаем 200, а не 500 — фронт больше НЕ будет показывать красную плашку
    return res.status(200).json({
      reply:
        "Извините, сейчас у меня небольшая техническая пауза. Попробуйте задать вопрос ещё раз или чуть позже. Если ошибка повторяется, можно написать администратору студии.",
    });
  }
});

// завершение диалога (вызывается при «Начать сначала» или по таймеру 10 минут)
app.post("/finish-dialog", async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(200).json({ status: "ok" });
    }

    const session = SESSIONS.get(sessionId);
    if (!session || session.finished) {
      return res.status(200).json({ status: "ok" });
    }

    session.finished = true;

    // отправляем отчёт в Telegram (вариант 3, как мы обсуждали)
    await sendDialogSummaryToTelegram(sessionId, session.messages);

    return res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error("Ошибка в /finish-dialog:", e);
    return res.status(200).json({ status: "error" });
  }
});

// ---------- Старт сервера ----------

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 CosmoDance server listening on port ${port}`);
});
