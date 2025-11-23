// server.js — упрощённый и стабильный вариант

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// --- базовая настройка сервера ---
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname)); // отдаём index.html и статику из этой же папки

// --- OpenAI клиент ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- внутреннее состояние сервера ---
let KNOWLEDGE_BASE = null; // то, что грузим через upload.js (knowledge.json)
let SCHEDULE = null;       // файл cosmo_schedule_all_branches_ready.json

// мягкая загрузка JSON из файла (если файла нет — просто лог и null)
async function loadJsonSafe(fileName) {
  try {
    const fullPath = path.join(__dirname, fileName);
    const text = await fs.readFile(fullPath, "utf8");
    return JSON.parse(text);
  } catch (e) {
    console.log(`Не удалось загрузить ${fileName}:`, e.message);
    return null;
  }
}

// один раз пробуем подтянуть локальные файлы
function loadInitialData() {
  loadJsonSafe("knowledge.json").then((data) => {
    if (data) {
      KNOWLEDGE_BASE = data;
      console.log("knowledge.json загружен");
    }
  });

  loadJsonSafe("cosmo_schedule_all_branches_ready.json").then((data) => {
    if (data) {
      SCHEDULE = data;
      console.log("cosmo_schedule_all_branches_ready.json загружен");
    }
  });
}

loadInitialData();

// ----- системный промпт -----
const SYSTEM_PROMPT = `
Ты — дружелюбный и внимательный ассистент студии танцев CosmoDance.

Задачи:
- Помогать подобрать направление и группы для взрослых и детей.
- Учитывать филиал (Звёздная, Озерки, Дыбенко, Купчино).
- Основываться на расписании групп (дни недели и время), не придумывать несуществующие группы.
- Для детей обязательно уточнять возраст и опыт, для взрослых — цели и примерный уровень.
- Группы ходят по расписанию (конкретные дни и время), свободного "когда хочу — тогда приду" нет.
- Индивидуальные занятия возможны по согласованию с тренером.
- Если есть пометка "команда" — это группа по отбору, туда рекомендуй только при наличии опыта.

Общение:
- Обращайся на "вы".
- Пиши простым, живым языком, как заботливый администратор.
- Если человек стесняется, переживает, что "все уже умеют", обязательно поддержи и успокой.
- Приветствия понимай в любом виде (привет, здравствуйте, добрый вечер, ку и т.д.) и отвечай приветствием.

Ограничения:
- Отвечай только по теме студии CosmoDance, танцев, расписания, цен, пробных занятий, записи.
- Если вопрос не по теме, мягко перенаправь: "Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."

Техническое:
- У тебя есть база знаний и расписание, которые передаёт сервер в виде текста "контекст".
- Не пиши, что "я ИИ" и не упоминай внутренние файлы.
`.trim();

// Собираем текстовый контекст из загруженных файлов
function buildContextText() {
  let parts = [];

  if (KNOWLEDGE_BASE) {
    parts.push(
      "Есть база вопросов и ответов по студии CosmoDance. Используй её, если она подходит к вопросу."
    );
  }

  if (SCHEDULE && Array.isArray(SCHEDULE.groups)) {
    // короткое человекочитаемое описание по филиалам
    const byBranch = {};
    for (const g of SCHEDULE.groups) {
      const branch = g.branch || "Неизвестный филиал";
      if (!byBranch[branch]) byBranch[branch] = [];
      const level = g.level ? ` (${g.level})` : "";
      let days = [];
      if (g.schedule) {
        for (const [dayShort, time] of Object.entries(g.schedule)) {
          if (!time) continue;
          // разворачиваем дни недели
          const fullDay =
            dayShort === "Пн"
              ? "Понедельник"
              : dayShort === "Вт"
              ? "Вторник"
              : dayShort === "Ср"
              ? "Среда"
              : dayShort === "Чт"
              ? "Четверг"
              : dayShort === "Пт"
              ? "Пятница"
              : dayShort === "Сб"
              ? "Суббота"
              : dayShort === "Вс"
              ? "Воскресенье"
              : dayShort;
          days.push(`${fullDay}: ${time}`);
        }
      }
      byBranch[branch].push(
        `${g.group_name}${level}${days.length ? " — " + days.join(", ") : ""}`
      );
    }

    const lines = [];
    for (const [branch, groups] of Object.entries(byBranch)) {
      lines.push(`Филиал ${branch}:`);
      lines.push("  " + groups.join("\n  "));
    }

    parts.push(
      "Краткое расписание групп по филиалам (не перечисляй всё целиком, используй по смыслу):\n" +
        lines.join("\n")
    );
  }

  if (!parts.length) return "";
  return "\n\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ ПО СТУДИИ:\n" + parts.join("\n\n");
}

// ----- маршруты -----

// Корневая страница чата
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// Загрузка базы знаний (upload.js шлёт сюда knowledge.json)
app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    KNOWLEDGE_BASE = body;
    let count = null;

    if (Array.isArray(body)) {
      count = body.length;
    } else if (body && Array.isArray(body.items)) {
      count = body.items.length;
    }

    console.log("База знаний обновлена, записей:", count ?? "неизвестно");
    return res.json({
      status: "ok",
      message: "База принята на сервере",
      count,
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    return res.status(200).json({
      status: "error",
      message: "Ошибка при загрузке базы, но сервер продолжает работать.",
    });
  }
});

// Основной чат-эндпоинт
app.post("/chat", async (req, res) => {
  try {
    const body = req.body || {};

    // история, которую отправляет фронт
    const history = Array.isArray(body.history) ? body.history : [];

    // userMessage на всякий случай поддерживаем для обратной совместимости
    let lastUserMessage = body.userMessage;

    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last && last.role === "user" && typeof last.text === "string") {
        lastUserMessage = last.text;
      }
    }

    if (!lastUserMessage || typeof lastUserMessage !== "string") {
      // НЕ выбрасываем 400, чтобы не ломать фронт — всегда 200 с нормальным ответом
      return res.json({
        reply: "Пожалуйста, напишите ваш вопрос о студии CosmoDance 😊",
      });
    }

    // собираем сообщения для модели
    const messagesForModel = [];

    messagesForModel.push({
      role: "system",
      content: SYSTEM_PROMPT + buildContextText(),
    });

    // добавляем историю диалога (обрезаем до последних 20 сообщений)
    const trimmedHistory = history.slice(-20);

    for (const m of trimmedHistory) {
      if (!m || !m.role || !m.text) continue;
      const role =
        m.role === "assistant" || m.role === "bot"
          ? "assistant"
          : m.role === "system"
          ? "system"
          : "user";
      messagesForModel.push({ role, content: m.text });
    }

    // если истории нет (первый запрос), добавляем последнего пользователя явно
    if (!trimmedHistory.length) {
      messagesForModel.push({ role: "user", content: lastUserMessage });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesForModel,
      temperature: 0.5,
      max_tokens: 700,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте переформулировать вопрос.";

    return res.json({ reply });
  } catch (error) {
    console.error("Ошибка в /chat:", error);
    // Важно: тоже возвращаем 200, чтобы на фронте не было "не удалось получить ответ от сервера"
    return res.json({
      reply:
        "Извините, сейчас у меня небольшая техническая пауза. Попробуйте задать вопрос ещё раз или переформулировать его.",
    });
  }
});

// Запуск сервера
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
