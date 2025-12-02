// server.js — ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Проверка обязательных переменных
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY не найден в .env файле!");
  console.log("📋 Создайте файл .env с содержимым:");
  console.log("OPENAI_API_KEY=sk-ваш_ключ_от_openai");
  console.log("PORT=3000");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS - разрешить всем на время разработки
app.use(cors());

// Лимит размера запросов
app.use(express.json({ limit: "100kb" }));

// Создаем папку для логов если её нет
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
}

// ---------- OpenAI клиент ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Загрузка данных ----------
function loadJSONFile(filename) {
  try {
    if (!fs.existsSync(filename)) {
      console.warn(`⚠️ Файл не найден: ${filename}`);
      return null;
    }
    const data = fs.readFileSync(filename, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${filename}:`, error.message);
    return null;
  }
}

// Загружаем данные
const KNOWLEDGE = loadJSONFile("knowledge.json");
const SCHEDULE = loadJSONFile("cosmo_schedule_all_branches_ready.json");

// Проверяем загрузку
if (!KNOWLEDGE) {
  console.error("❌ Не удалось загрузить knowledge.json");
}
if (!SCHEDULE) {
  console.warn("⚠️ Не удалось загрузить расписание");
}

// ---------- Формирование контекста ----------
function buildScheduleText() {
  if (!SCHEDULE || !Array.isArray(SCHEDULE.groups)) {
    return "Расписание временно недоступно. Пожалуйста, уточните у администратора.";
  }

  // Только группы с расписанием
  const groupsWithSchedule = SCHEDULE.groups.filter(g => 
    g.schedule && Object.keys(g.schedule).length > 0
  );

  if (groupsWithSchedule.length === 0) {
    return "Расписание уточняется. Пожалуйста, свяжитесь с администратором.";
  }

  const DAY_FULL = {
    "Пн": "понедельник",
    "Вт": "вторник",
    "Ср": "среда",
    "Чт": "четверг",
    "Пт": "пятница",
    "Сб": "суббота",
    "Вс": "воскресенье",
  };

  return groupsWithSchedule.slice(0, 20).map((g) => {
    const times = Object.entries(g.schedule || {})
      .map(([shortDay, time]) => {
        const fullDay = DAY_FULL[shortDay] || shortDay;
        return `${fullDay}: ${time}`;
      });

    return `Филиал: ${g.branch || "не указан"}. Группа: ${g.group_name || "не указана"}. Расписание: ${times.join(", ")}.`;
  }).join("\n");
}

function buildKnowledgeText() {
  if (!KNOWLEDGE || !Array.isArray(KNOWLEDGE.docs)) {
    return "Информация о студии временно недоступна.";
  }
  
  // Берем все документы
  return KNOWLEDGE.docs.map(d => `### ${d.title}\n${d.text}`).join("\n\n");
}

function getContext() {
  const knowledgeText = buildKnowledgeText();
  const scheduleText = buildScheduleText();
  
  return `${knowledgeText}\n\n### Расписание групп:\n${scheduleText}`;
}

// ---------- Системная подсказка ----------
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.

Используй информацию из базы знаний для ответов на вопросы:
• О студии и филиалах
• О направлениях танцев
• О ценах и абонементах
• О расписании занятий
• О пробных занятиях

Если точной информации нет — предложи связаться с администратором.
Отвечай вежливо, дружелюбно, всегда на "вы".
Отказывайся отвечать на вопросы не по теме студии.`;

// ---------- Статика и маршруты ----------
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/chat", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, history = [] } = req.body;
    const userMessage = (message || "").trim();
    
    if (!userMessage) {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос о студии CosmoDance."
      });
    }

    console.log(`📨 Запрос: "${userMessage.substring(0, 50)}..."`);

    // Подготовка истории
    const safeHistory = history
      .filter(m => m && m.role && m.content && m.content.trim())
      .slice(-5) // Берем последние 5 сообщений
      .map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.trim()
      }));

    // Получаем контекст
    const context = getContext();

    // Формируем сообщения для OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `База знаний студии CosmoDance:\n${context}` },
      ...safeHistory,
      { role: "user", content: userMessage }
    ];

    // Вызов OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, не удалось сформировать ответ. Пожалуйста, попробуйте еще раз.";

    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Ответ за ${responseTime}ms, токенов: ${completion.usage?.total_tokens || 0}`);

    res.json({ reply });

  } catch (error) {
    console.error("❌ Ошибка в /chat:", error);
    
    let errorMessage = "Извините, произошла ошибка. Попробуйте позже.";
    
    if (error.code === 'insufficient_quota') {
      errorMessage = "Превышен лимит запросов. Попробуйте позже.";
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = "Слишком много запросов. Пожалуйста, подождите.";
    } else if (error.message.includes('ENOENT')) {
      errorMessage = "Ошибка загрузки данных. Сервер временно недоступен.";
    }

    res.status(500).json({ 
      reply: errorMessage
    });
  }
});

app.get("/health", (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    knowledgeLoaded: !!KNOWLEDGE,
    scheduleLoaded: !!SCHEDULE,
    scheduleCount: SCHEDULE?.groups?.length || 0,
    knowledgeCount: KNOWLEDGE?.docs?.length || 0
  };
  res.json(health);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`📁 Папка: ${__dirname}`);
  console.log(`🔑 OpenAI ключ: ${process.env.OPENAI_API_KEY ? '✅ Установлен' : '❌ Отсутствует'}`);
  console.log(`📚 База знаний: ${KNOWLEDGE ? '✅ Загружена' : '❌ Не загружена'}`);
  console.log(`📅 Расписание: ${SCHEDULE ? '✅ Загружено' : '❌ Не загружено'}`);
  console.log(`🌐 Откройте: http://localhost:${port}`);
});
