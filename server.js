// server.js - CosmoDance Chat Bot v2.0
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Импортируем наши модули
import DeepSeekAI from "./deepseek-ai.js";
import CosmoScheduleParser from "./schedule-parser.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ ИНИЦИАЛИЗАЦИЯ ============
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));

// ============ ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ ============
const aiClient = new DeepSeekAI(process.env.DEEPSEEK_API_KEY);
const scheduleParser = new CosmoScheduleParser('production');

// ============ ЗАГРУЗКА БАЗЫ ЗНАНИЙ ============
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

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function buildKnowledgeText() {
  if (!KNOWLEDGE.docs || !Array.isArray(KNOWLEDGE.docs)) {
    return "Информация о студии временно недоступна.";
  }
  
  let text = "";
  KNOWLEDGE.docs.forEach(doc => {
    text += `## ${doc.title}\n${doc.text}\n\n`;
  });
  return text;
}

async function getScheduleContext(branch = null) {
  try {
    const schedule = await scheduleParser.getSchedule(branch);
    
    if (!schedule || Object.keys(schedule).length === 0) {
      return "📅 Расписание временно недоступно. Пожалуйста, проверьте на сайте: https://cosmo.su/raspisanie/";
    }

    let scheduleText = "";
    
    // Убираем метаданные из вывода
    const scheduleData = { ...schedule };
    if (scheduleData._meta) {
      delete scheduleData._meta;
    }

    Object.entries(scheduleData).forEach(([branchName, groups]) => {
      if (groups && groups.length > 0) {
        scheduleText += `📍 **${branchName}:**\n`;
        groups.slice(0, 6).forEach((group, index) => {
          scheduleText += `${index + 1}. ${group}\n`;
        });
        
        if (groups.length > 6) {
          scheduleText += `... и еще ${groups.length - 6} групп\n`;
        }
        scheduleText += '\n';
      }
    });

    scheduleText += "\n🔗 **Полное расписание:** https://cosmo.su/raspisanie/";
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

ВАЖНЫЕ ПРАВИЛА:
1. Если спрашивают про расписание — используй актуальные данные из контекста
2. Если точного времени нет — предложи проверить на сайте или связаться с администратором
3. При подборе группы учитывай возраст, уровень и филиал
4. Всегда мотивируй новичков, снимай страхи
5. Подводи к записи на пробное занятие

СТИЛЬ ОТВЕТОВ:
• Структурированные ответы с абзацами
• Эмодзи для наглядности ✨
• Поддержка и мотивация для новичков
• Четкие следующий шаги (запись, консультация)

ЕСЛИ НЕ ЗНАЕШЬ ОТВЕТ:
• Честно скажи, что нужно уточнить у администратора
• Предложи оставить контакты для обратной связи
• Дай ссылку на сайт с полной информацией`;

// ============ МАРШРУТЫ API ============

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
    
    // Быстрые ответы на частые вопросы (чтобы экономить токены)
    const quickResponses = {
      'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?',
      'сайт': '🌐 Наш сайт: https://cosmo.su/',
      'телефон': '📞 Телефон студии: +7 (XXX) XXX-XX-XX',
      'адрес': '📍 Наши филиалы: Дыбенко, Купчино, Звёздная, Озерки\nПодробнее: https://cosmo.su/филиалы/',
    };

    for (const [key, response] of Object.entries(quickResponses)) {
      if (lowerMessage.includes(key)) {
        return res.json({ reply: response });
      }
    }

    // Формируем сообщения для DeepSeek
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `### База знаний студии:\n${knowledgeText}` },
      { role: "system", content: `### Актуальное расписание:\n${scheduleText}` },
      { role: "user", content: userMessage }
    ];

    // Вызов DeepSeek API
    const result = await aiClient.chat(messages, {
      temperature: 0.7,
      maxTokens: 800
    });

    console.log(`✅ Ответ сформирован (${result.usage?.total_tokens || '?'} токенов)`);

    res.json({ 
      reply: result.content,
      tokens: result.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error("❌ Ошибка обработки запроса:", error.message);
    
    let errorMessage = "Извините, произошла ошибка при обработке вашего запроса. ";
    
    if (error.message.includes('rate limit')) {
      errorMessage = "Превышен лимит запросов. Пожалуйста, попробуйте через минуту.";
    } else if (error.message.includes('insufficient_quota')) {
      errorMessage = "Лимит запросов исчерпан на сегодня. Попробуйте завтра.";
    } else if (error.message.includes('Invalid API key')) {
      errorMessage = "Проблема с подключением к AI. Администратор уведомлен.";
    }
    
    // Добавляем fallback
    errorMessage += "\n\n📞 Вы можете связаться с нами напрямую:\n• Сайт: https://cosmo.su/\n• Расписание: https://cosmo.su/raspisanie/";
    
    res.json({ reply: errorMessage });
  }
});

// API для получения расписания
app.get("/api/schedule", async (req, res) => {
  try {
    const { branch } = req.query;
    const schedule = await scheduleParser.getSchedule(branch);
    
    res.json({
      success: true,
      data: schedule,
      last_updated: new Date().toISOString(),
      source: "https://cosmo.su/raspisanie/"
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
app.get("/health", async (req, res) => {
  const stats = scheduleParser.getStats();
  
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "2.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    features: {
      schedule_parser: true,
      ai_enabled: true,
      knowledge_base: KNOWLEDGE.docs?.length || 0,
      deepseek_api: !!process.env.DEEPSEEK_API_KEY
    },
    limits: {
      daily_requests: "1000 (DeepSeek free tier)",
      schedule_cache: "2 hours",
      tokens_per_request: "800"
    },
    links: {
      schedule: "https://cosmo.su/raspisanie/",
      website: "https://cosmo.su/",
      chat: "/"
    }
  });
});

// Тестовый эндпоинт для проверки AI
app.get("/test/ai", async (req, res) => {
  try {
    const testPrompt = "Привет! Расскажи кратко о студии CosmoDance в двух предложениях";
    const result = await aiClient.chat([
      { role: "system", content: "Ты ассистент студии танцев CosmoDance." },
      { role: "user", content: testPrompt }
    ]);
    
    res.json({
      success: true,
      prompt: testPrompt,
      response: result.content,
      tokens: result.usage?.total_tokens,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
  console.log(`🤖 AI: DeepSeek Chat (активен)`);
  console.log(`📅 Парсер расписания: АКТИВЕН`);
  console.log(`🎯 Лимиты: 1000 запросов/день бесплатно`);
  console.log("=".repeat(60));
  
  // Загружаем расписание при старте
  console.log("🔄 Первоначальная загрузка расписания...");
  scheduleParser.getSchedule().then(() => {
    console.log("✅ Расписание загружено и готово к работе");
  }).catch(error => {
    console.log("⚠️ Ошибка загрузки расписания:", error.message);
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
