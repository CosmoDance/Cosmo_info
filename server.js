// server.js — ИСПРАВЛЕННАЯ ВЕРСИЯ
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from 'express-rate-limit';
import winston from 'winston';

dotenv.config();

// Проверка обязательных переменных
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY не найден в .env файле!");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Настройка CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://ваш-домен.ru'] 
    : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Лимит размера запросов
app.use(express.json({ limit: "100kb" }));

// Логирование
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Rate limiting
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { 
    reply: "Слишком много запросов. Пожалуйста, подождите 15 минут." 
  }
});

// ---------- OpenAI клиент ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Загрузка и кэширование данных ----------
let KNOWLEDGE = null;
let SCHEDULE = null;
let cachedContext = null;
let lastCacheUpdate = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

function safeLoadJSON(relativePath, label) {
  try {
    const fullPath = path.join(__dirname, relativePath);
    if (!fs.existsSync(fullPath)) {
      logger.warn(`${label} файл не найден: ${fullPath}`);
      return null;
    }
    const text = fs.readFileSync(fullPath, "utf8");
    const data = JSON.parse(text);
    logger.info(`${label} успешно загружен`);
    return data;
  } catch (e) {
    logger.error(`Ошибка загрузки ${label}: ${e.message}`);
    return null;
  }
}

function loadData() {
  KNOWLEDGE = safeLoadJSON("cosmo-knowledge-full.json", "KNOWLEDGE");
  SCHEDULE = safeLoadJSON("cosmo_schedule_all_branches_ready.json", "SCHEDULE");
  
  if (!KNOWLEDGE || !SCHEDULE) {
    logger.error("Не удалось загрузить данные для бота");
  }
}

function buildScheduleText() {
  if (!SCHEDULE || !Array.isArray(SCHEDULE.groups)) {
    return "Расписание временно недоступно.";
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

  return SCHEDULE.groups.map((g) => {
    const times = Object.entries(g.schedule || {})
      .filter(([_, v]) => v && String(v).trim() !== "")
      .map(([shortDay, time]) => {
        const fullDay = DAY_FULL[shortDay] || shortDay;
        return `${fullDay}: ${time}`;
      });

    const scheduleStr = times.length > 0
      ? times.join(", ")
      : "расписание уточняется";

    return `Филиал: ${g.branch || "не указан"}. Группа: ${g.group_name || "не указана"}. Преподаватель: ${g.teacher || "уточняется"}. Расписание: ${scheduleStr}.`;
  }).join("\n");
}

function buildKnowledgeText() {
  if (!KNOWLEDGE || !Array.isArray(KNOWLEDGE.docs)) {
    return "Информация о студии временно недоступна.";
  }
  
  // Берем только первые 20 документов чтобы не перегружать контекст
  const limitedDocs = KNOWLEDGE.docs.slice(0, 20);
  return limitedDocs.map(d => `### ${d.title}\n${d.text}`).join("\n\n");
}

function getContext() {
  const now = Date.now();
  if (!cachedContext || !lastCacheUpdate || (now - lastCacheUpdate) > CACHE_TTL) {
    cachedContext = `${buildKnowledgeText()}\n\n${buildScheduleText()}`;
    lastCacheUpdate = now;
    
    // Обрезка контекста (~15000 токенов максимум)
    const maxLength = 60000; // символов
    if (cachedContext.length > maxLength) {
      cachedContext = cachedContext.substring(0, maxLength) + "...\n\n[Информация обрезана для оптимизации]";
    }
  }
  return cachedContext;
}

// Загружаем данные при старте
loadData();

// ---------- Системная подсказка ----------
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.
Отвечай только по теме студии. Если вопрос не про студию — вежливо откажись отвечать.
Всегда обращайся на "вы". Будь доброжелательным и поддерживающим.`;

// ---------- Статика и маршруты ----------
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/chat", chatLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, history = [] } = req.body;
    const userMessage = (message || "").trim();
    
    if (!userMessage) {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос.",
        error: "Пустое сообщение"
      });
    }

    // Логируем запрос
    logger.info('Chat request', {
      message: userMessage.substring(0, 100),
      historyLength: history.length,
      ip: req.ip
    });

    // Подготовка истории
    const safeHistory = history
      .filter(m => m && m.role && m.content && m.content.trim())
      .slice(-10) // Берем последние 10 сообщений
      .map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.trim()
      }));

    // Получаем актуальный контекст
    const context = getContext();

    // Формируем сообщения для OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `База знаний студии:\n${context}` },
      ...safeHistory,
      { role: "user", content: userMessage }
    ];

    // Вызов OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // ИСПРАВЛЕНО: используем существующую модель
      messages,
      temperature: 0.5,
      max_tokens: 800,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, не удалось сформировать ответ. Пожалуйста, попробуйте еще раз.";

    const responseTime = Date.now() - startTime;
    
    // Логируем успешный ответ
    logger.info('Chat response', {
      responseTime: `${responseTime}ms`,
      tokensUsed: completion.usage?.total_tokens || 0
    });

    res.json({ reply });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Chat error', {
      error: error.message,
      stack: error.stack,
      responseTime: `${responseTime}ms`,
      ip: req.ip
    });

    // Пользовательские сообщения об ошибках
    let errorMessage = "Извините, произошла ошибка. Попробуйте позже.";
    
    if (error.code === 'insufficient_quota') {
      errorMessage = "Извините, превышен лимит запросов. Попробуйте позже.";
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = "Слишком много запросов. Пожалуйста, подождите немного.";
    }

    res.status(500).json({ 
      reply: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get("/health", (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    dataLoaded: !!(KNOWLEDGE && SCHEDULE),
    memoryUsage: process.memoryUsage()
  };
  res.json(health);
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  logger.info(`Сервер запущен на порту ${port}`);
  logger.info(`Режим: ${process.env.NODE_ENV || 'development'}`);
});
