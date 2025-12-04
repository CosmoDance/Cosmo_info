// server.js - CosmoDance Chat Bot v2.1
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Импортируем наши модули
import DeepSeekAI from "./deepseek-ai.js";
import CosmoParser from "./cosmo-parser.js";

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
const cosmoParser = new CosmoParser();

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
  
  let text = "## База знаний CosmoDance\n\n";
  KNOWLEDGE.docs.forEach(doc => {
    text += `### ${doc.title}\n${doc.text}\n\n`;
  });
  return text;
}

async function getScheduleContext(branch = null) {
  try {
    const schedule = await cosmoParser.getSchedule();
    
    if (!schedule || Object.keys(schedule).length === 0) {
      return "📅 Расписание временно недоступно. Пожалуйста, проверьте на сайте: https://cosmo.su/raspisanie/";
    }

    let scheduleText = "## 📅 Актуальное расписание занятий\n\n";
    
    // Убираем метаданные из вывода
    const scheduleData = { ...schedule };
    if (scheduleData._meta) {
      delete scheduleData._meta;
    }

    // Если запросили конкретный филиал
    if (branch) {
      const branchNames = Object.keys(scheduleData).filter(k => k !== '_meta');
      const foundBranch = branchNames.find(b => 
        b.toLowerCase().includes(branch.toLowerCase()) || 
        branch.toLowerCase().includes(b.toLowerCase())
      );
      
      if (foundBranch && scheduleData[foundBranch]) {
        scheduleText += `### 📍 Филиал: ${foundBranch}\n\n`;
        scheduleData[foundBranch].forEach((item, index) => {
          scheduleText += `${index + 1}. ${item}\n`;
        });
      } else {
        scheduleText += `### ⚠️ Филиал "${branch}" не найден\n\n`;
        scheduleText += "**Доступные филиалы:**\n";
        branchNames.forEach(b => {
          if (b !== 'Информация' && b !== 'Филиалы') {
            scheduleText += `• ${b}\n`;
          }
        });
      }
    } else {
      // Показываем все филиалы
      Object.entries(scheduleData).forEach(([branchName, items]) => {
        if (branchName !== 'Информация' && branchName !== 'Филиалы' && items && items.length > 0) {
          scheduleText += `### 📍 ${branchName}\n\n`;
          items.slice(0, 5).forEach((item, index) => {
            scheduleText += `${index + 1}. ${item}\n`;
          });
          scheduleText += '\n';
        }
      });
    }

    scheduleText += "\n---\n";
    scheduleText += "🔗 **Актуальное расписание:** https://cosmo.su/raspisanie/\n";
    scheduleText += "📞 **Для уточнения:** свяжитесь с администратором студии\n";

    return scheduleText;

  } catch (error) {
    console.error('Ошибка получения расписания:', error.message);
    return "📅 Не удалось загрузить расписание. Проверьте: https://cosmo.su/raspisanie/";
  }
}

async function getPricesContext() {
  try {
    const prices = await cosmoParser.getPrices();
    
    if (!prices || Object.keys(prices).length === 0) {
      return "💰 Цены временно недоступны. Пожалуйста, проверьте на сайте: https://cosmo.su/prices/";
    }

    let pricesText = "## 💰 Цены и абонементы\n\n";
    
    Object.entries(prices).forEach(([category, content], index) => {
      if (category !== 'Информация' && content) {
        pricesText += `### ${category}\n`;
        pricesText += `${content}\n\n`;
      }
    });

    pricesText += "\n---\n";
    pricesText += "🔗 **Актуальные цены:** https://cosmo.su/prices/\n";
    pricesText += "💳 **Оплата:** наличные, карта, перевод\n";
    pricesText += "🎁 **Есть скидки:** семейные, для студентов\n";

    return pricesText;

  } catch (error) {
    console.error('Ошибка получения цен:', error.message);
    return "💰 Не удалось загрузить цены. Проверьте: https://cosmo.su/prices/";
  }
}

// ============ СИСТЕМНЫЙ ПРОМПТ ============
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.
Используй информацию из базы знаний для ответов на вопросы.
Отвечай вежливо, всегда на "вы", дружелюбно и профессионально.

ВАЖНЫЕ ПРАВИЛА:
1. Если спрашивают про расписание — используй актуальные данные из контекста
2. Если спрашивают про цены — используй информацию о ценах из контекста
3. Если точной информации нет — предложи проверить на сайте или связаться с администратором
4. При подборе группы учитывай возраст, уровень и филиал
5. Всегда мотивируй новичков, снимай страхи
6. Подводи к записи на пробное занятие

СТИЛЬ ОТВЕТОВ:
• Структурированные ответы с абзацами
• Используй эмодзи для наглядности ✨
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

    // Быстрые ответы на частые вопросы (для экономии токенов)
    const quickResponses = {
      'сайт': '🌐 Наш сайт: https://cosmo.su/',
      'телефон': '📞 Телефон студии: +7 (XXX) XXX-XX-XX',
      'адрес': '📍 Наши филиалы: Дыбенко, Купчино, Звёздная, Озерки\nПодробнее: https://cosmo.su/филиалы/',
      'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?'
    };

    for (const [key, response] of Object.entries(quickResponses)) {
      if (lowerMessage.includes(key)) {
        return res.json({ reply: response });
      }
    }

    // Формируем контекст
    const knowledgeText = buildKnowledgeText();
    const scheduleText = await getScheduleContext(branchFilter);
    const pricesText = await getPricesContext();
    
    // Если спрашивают только расписание или цены - отвечаем сразу
    if (lowerMessage.includes('расписание') && !lowerMessage.includes('?')) {
      const scheduleData = await cosmoParser.getSchedule();
      let response = "📅 **Расписание CosmoDance:**\n\n";
      
      if (branchFilter) {
        const branchData = scheduleData[branchFilter];
        if (branchData) {
          response += `📍 **${branchFilter}:**\n`;
          branchData.slice(0, 5).forEach(item => {
            response += `• ${item}\n`;
          });
        }
      } else {
        Object.entries(scheduleData).forEach(([branch, items]) => {
          if (branch !== '_meta' && items && items.length > 0) {
            response += `📍 **${branch}:**\n`;
            items.slice(0, 2).forEach(item => {
              response += `• ${item}\n`;
            });
            response += '\n';
          }
        });
      }
      
      response += `\n🔗 Полное расписание: https://cosmo.su/raspisanie/`;
      return res.json({ reply: response });
    }
    
    if (lowerMessage.includes('цена') && !lowerMessage.includes('?')) {
      const pricesData = await cosmoParser.getPrices();
      let response = "💰 **Цены CosmoDance:**\n\n";
      
      Object.entries(pricesData).forEach(([category, content]) => {
        if (category !== 'Информация' && content) {
          response += `**${category}:**\n`;
          response += `${content.substring(0, 200)}...\n\n`;
        }
      });
      
      response += `🔗 Полные цены: https://cosmo.su/prices/`;
      return res.json({ reply: response });
    }

    // Формируем сообщения для DeepSeek
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `### БАЗА ЗНАНИЙ СТУДИИ:\n${knowledgeText}` },
      { role: "system", content: `### АКТУАЛЬНОЕ РАСПИСАНИЕ:\n${scheduleText}` },
      { role: "system", content: `### ЦЕНЫ И АБОНЕМЕНТЫ:\n${pricesText}` },
      { role: "user", content: userMessage }
    ];

    // Вызов DeepSeek API
    const result = await aiClient.chat(messages, {
      temperature: 0.7,
      maxTokens: 1000
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
    
    // Fallback ответ
    errorMessage += "\n\n📞 Вы можете связаться с нами напрямую:\n";
    errorMessage += "• Сайт: https://cosmo.su/\n";
    errorMessage += "• Расписание: https://cosmo.su/raspisanie/\n";
    errorMessage += "• Цены: https://cosmo.su/prices/\n";
    
    res.json({ reply: errorMessage });
  }
});

// API для получения расписания
app.get("/api/schedule", async (req, res) => {
  try {
    const { branch } = req.query;
    const schedule = await cosmoParser.getSchedule();
    
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

// API для получения цен
app.get("/api/prices", async (req, res) => {
  try {
    const prices = await cosmoParser.getPrices();
    
    res.json({
      success: true,
      data: prices,
      last_updated: new Date().toISOString(),
      source: "https://cosmo.su/prices/"
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      link: "https://cosmo.su/prices/"
    });
  }
});

// Статистика и здоровье
app.get("/health", async (req, res) => {
  const stats = cosmoParser.getStats();
  
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "2.1",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    features: {
      schedule_parser: true,
      prices_parser: true,
      ai_enabled: true,
      knowledge_base: KNOWLEDGE.docs?.length || 0,
      deepseek_api: !!process.env.DEEPSEEK_API_KEY
    },
    stats: {
      schedule_requests: stats.scheduleRequests,
      price_requests: stats.priceRequests,
      errors: stats.errors,
      cache_valid: stats.cacheValid
    },
    links: {
      schedule: "https://cosmo.su/raspisanie/",
      prices: "https://cosmo.su/prices/",
      website: "https://cosmo.su/",
      chat: "/"
    }
  });
});

// Тестовый эндпоинт для проверки парсера
app.get("/test/parser", async (req, res) => {
  try {
    const [schedule, prices] = await Promise.all([
      cosmoParser.getSchedule(),
      cosmoParser.getPrices()
    ]);
    
    res.json({
      success: true,
      schedule_keys: Object.keys(schedule).filter(k => !k.startsWith('_')),
      prices_keys: Object.keys(prices),
      schedule_sample: schedule['Звёздная'] || schedule[Object.keys(schedule)[0]],
      prices_sample: prices[Object.keys(prices)[0]]?.substring(0, 200),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Очистка кэша (админ)
app.post("/admin/clear-cache", (req, res) => {
  const { key } = req.body;
  
  if (key === process.env.ADMIN_KEY || process.env.NODE_ENV === 'development') {
    cosmoParser.clearCache();
    res.json({ success: true, message: "Кэш парсера очищен" });
  } else {
    res.status(403).json({ success: false, message: "Доступ запрещен" });
  }
});

// ============ ЗАПУСК СЕРВЕРА ============
const port = process.env.PORT || 10000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log("=".repeat(60));
  console.log("🚀 CosmoDance Chat Bot v2.1 ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log(`🤖 AI: DeepSeek Chat (активен)`);
  console.log(`📅 Парсер расписания: АКТИВЕН`);
  console.log(`💰 Парсер цен: АКТИВЕН`);
  console.log(`🎯 Лимиты: 1000 запросов/день бесплатно`);
  console.log("=".repeat(60));
  
  // Загружаем данные при старте
  console.log("🔄 Первоначальная загрузка данных...");
  Promise.all([
    cosmoParser.getSchedule(),
    cosmoParser.getPrices()
  ]).then(() => {
    console.log("✅ Данные загружены и готовы к работе");
  }).catch(error => {
    console.log("⚠️ Ошибка загрузки данных:", error.message);
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
