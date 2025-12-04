// server.js - ФИНАЛЬНАЯ ВЕРСИЯ С РАСПИСАНИЕМ
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Импортируем парсер расписания
import CosmoScheduleParser from "./schedule-parser.js";

dotenv.config();

// ============ ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ============
const REQUIRED_ENV = ['OPENAI_API_KEY'];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Требуется переменная окружения: ${key}`);
    process.exit(1);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ============
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: "100kb" }));

// ============ ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ ============
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const scheduleParser = new CosmoScheduleParser(
  process.env.NODE_ENV === 'development' ? 'development' : 'production'
);

// ============ ЗАГРУЗКА ДАННЫХ ============
function loadKnowledge() {
  try {
    const data = fs.readFileSync("knowledge.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("❌ Ошибка загрузки knowledge.json:", error.message);
    return { docs: [] };
  }
}

const KNOWLEDGE = loadKnowledge();

// ============ ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ ============
function buildKnowledgeText() {
  if (!KNOWLEDGE.docs || !Array.isArray(KNOWLEDGE.docs)) {
    return "Информация о студии временно недоступна.";
  }
  
  return KNOWLEDGE.docs.map(d => `### ${d.title}\n${d.text}`).join("\n\n");
}

async function getScheduleContext(branch = null) {
  try {
    const schedule = await scheduleParser.getSchedule(branch);
    
    if (!schedule || Object.keys(schedule).length === 0) {
      return "📅 Расписание временно недоступно. Пожалуйста, проверьте на сайте: https://cosmo.su/raspisanie/";
    }

    let scheduleText = "📅 **Актуальное расписание занятий:**\n\n";
    
    // Убираем метаданные из вывода
    const scheduleData = { ...schedule };
    if (scheduleData._meta) {
      delete scheduleData._meta;
    }

    Object.entries(scheduleData).forEach(([branchName, groups]) => {
      if (groups && groups.length > 0) {
        scheduleText += `📍 **${branchName}:**\n`;
        groups.slice(0, 8).forEach((group, index) => {
          scheduleText += `${index + 1}. ${group}\n`;
        });
        
        if (groups.length > 8) {
          scheduleText += `... и еще ${groups.length - 8} групп\n`;
        }
        scheduleText += '\n';
      }
    });

    scheduleText += "\n🔗 **Полное расписание:** https://cosmo.su/raspisanie/";
    scheduleText += "\n🕐 **Обновлено:** каждые 2 часа автоматически";
    scheduleText += "\n📞 **Уточнить:** свяжитесь с администратором студии";

    return scheduleText;

  } catch (error) {
    console.error('Ошибка получения расписания:', error.message);
    return "📅 Не удалось загрузить расписание. Проверьте: https://cosmo.su/raspisanie/";
  }
}

// ============ СИСТЕМНЫЙ ПРОМПТ ============
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.
Используй информацию из базы знаний для ответов на вопросы.
Отвечай вежливо, всегда на "вы", дружелюбно и профессионально.

ВАЖНО про расписание:
1. Если спрашивают про расписание — используй актуальные данные из контекста
2. Если точного времени нет — предложи проверить на сайте или связаться с администратором
3. При подборе группы учитывай возраст, уровень и филиал

Стиль ответов:
• Структурированные ответы с абзацами
• Эмодзи для наглядности
• Поддержка и мотивация для новичков
• Четкие следующий шаги (запись, консультация)`;

// ============ МАРШРУТЫ API ============

// Статика
app.use(express.static(__dirname));

// Главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Чат с ботом
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const userMessage = (message || "").trim();
    
    if (!userMessage) {
      return res.json({
        reply: "👋 Пожалуйста, напишите ваш вопрос о студии CosmoDance."
      });
    }

    console.log(`📨 Запрос: "${userMessage.substring(0, 100)}..."`);

    // Определяем, о каком филиале спрашивают
    let branchFilter = null;
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('дыбенко')) branchFilter = 'Дыбенко';
    else if (lowerMessage.includes('купчино')) branchFilter = 'Купчино';
    else if (lowerMessage.includes('звезд') || lowerMessage.includes('звёзд')) branchFilter = 'Звёздная';
    else if (lowerMessage.includes('озерк')) branchFilter = 'Озерки';

    // Формируем контекст с актуальным расписанием
    const knowledgeText = buildKnowledgeText();
    const scheduleText = await getScheduleContext(branchFilter);

    // Сообщения для OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `### База знаний студии:\n${knowledgeText}` },
      { role: "system", content: `### Актуальное расписание:\n${scheduleText}` },
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

    console.log(`✅ Ответ отправлен (${reply.length} символов)`);

    res.json({ reply });

  } catch (error) {
    console.error("❌ Ошибка обработки запроса:", error);
    
    let errorMessage = "Извините, произошла ошибка. Попробуйте позже.";
    
    if (error.code === 'insufficient_quota') {
      errorMessage = "Превышен лимит запросов к AI. Попробуйте через час.";
    } else if (error.response?.status === 429) {
      errorMessage = "Слишком много запросов. Пожалуйста, подождите немного.";
    }

    res.json({ reply: errorMessage });
  }
});

// Информация о расписании
app.get("/api/schedule", async (req, res) => {
  try {
    const { branch } = req.query;
    const schedule = await scheduleParser.getSchedule(branch);
    const stats = scheduleParser.getStats();
    
    res.json({
      success: true,
      schedule: schedule,
      stats: stats,
      last_updated: stats.lastUpdate,
      next_update: stats.nextUpdate
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      link: "https://cosmo.su/raspisanie/"
    });
  }
});

// Статистика и здоровье
app.get("/health", (req, res) => {
  const stats = scheduleParser.getStats();
  
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "2.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    data: {
      knowledge: KNOWLEDGE.docs?.length || 0,
      schedule_requests: stats.requests,
      schedule_success_rate: stats.requests > 0 ? 
        Math.round((stats.successes / stats.requests) * 100) : 0,
      cache_valid: stats.cacheValid
    },
    links: {
      schedule: "https://cosmo.su/raspisanie/",
      website: "https://cosmo.su/",
      chat: "/"
    }
  });
});

// Очистка кэша (админ)
app.post("/admin/clear-cache", (req, res) => {
  const { key } = req.body;
  
  if (key === process.env.ADMIN_KEY || process.env.NODE_ENV === 'development') {
    scheduleParser.clearCache();
    res.json({ success: true, message: "Кэш расписания очищен" });
  } else {
    res.status(403).json({ success: false, message: "Доступ запрещен" });
  }
});

// ============ ЗАПУСК СЕРВЕРА ============
const port = process.env.PORT || 10000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log("=".repeat(60));
  console.log("🚀 CosmoDance Chat Bot ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log(`📅 Парсер расписания: АКТИВЕН (обновление каждые 2 часа)`);
  console.log(`🤖 OpenAI модель: gpt-4o-mini`);
  console.log(`📚 База знаний: ${KNOWLEDGE.docs?.length || 0} документов`);
  console.log("=".repeat(60));
  
  // Загружаем расписание при старте
  console.log("🔄 Первоначальная загрузка расписания...");
  scheduleParser.getSchedule().then(() => {
    console.log("✅ Расписание загружено и готово к работе");
  }).catch(error => {
    console.log("⚠️ Не удалось загрузить расписание при старте:", error.message);
  });
});

// Обработка завершения
process.on('SIGTERM', () => {
  console.log('🔄 Получен SIGTERM, завершаем работу...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Получен SIGINT, завершаем работу...');
  process.exit(0);
});
