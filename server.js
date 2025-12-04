// server.js - CosmoDance Chat Bot v2.2
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
    // Получаем ОЧИЩЕННОЕ расписание для клиентов (только для новичков)
    const schedule = await cosmoParser.getClientSchedule(branch);
    
    if (!schedule || Object.keys(schedule).length === 0) {
      return "📅 Расписание временно недоступно. Пожалуйста, проверьте на сайте: https://cosmo.su/raspisanie/";
    }

    let scheduleText = "## 📅 Расписание занятий (группы для начинающих)\n\n";
    
    // Убираем метаданные из вывода
    const scheduleData = { ...schedule };
    if (scheduleData._meta) {
      delete scheduleData._meta;
    }

    // Если запросили конкретный филиал
    if (branch) {
      const branchNames = Object.keys(scheduleData).filter(k => !k.startsWith('_'));
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
          scheduleText += `• ${b}\n`;
        });
      }
    } else {
      // Показываем все филиалы
      Object.entries(scheduleData).forEach(([branchName, items]) => {
        if (items && items.length > 0) {
          scheduleText += `### 📍 ${branchName}\n\n`;
          items.slice(0, 4).forEach((item, index) => {
            scheduleText += `${index + 1}. ${item}\n`;
          });
          
          if (items.length > 4) {
            scheduleText += `... и ещё ${items.length - 4} групп\n`;
          }
          scheduleText += '\n';
        }
      });
    }

    scheduleText += "---\n";
    scheduleText += "🎯 **Все группы для начинающих**\n";
    scheduleText += "📅 **Актуальное расписание:** https://cosmo.su/raspisanie/\n";
    scheduleText += "📞 **Запись:** свяжитесь с администратором\n";

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
        
        // Очищаем длинный текст
        if (content.length > 300) {
          pricesText += `${content.substring(0, 300)}...\n\n`;
        } else {
          pricesText += `${content}\n\n`;
        }
      }
    });

    pricesText += "---\n";
    pricesText += "💳 **Оплата:** наличные, карта, онлайн\n";
    pricesText += "🎁 **Скидки:** семейные, студентам, при покупке 2+ абонементов\n";
    pricesText += "🔗 **Актуальные цены:** https://cosmo.su/prices/\n";

    return pricesText;

  } catch (error) {
    console.error('Ошибка получения цен:', error.message);
    return "💰 Не удалось загрузить цены. Проверьте: https://cosmo.su/prices/";
  }
}

// ============ СИСТЕМНЫЙ ПРОМПТ (ОБНОВЛЕННЫЙ) ============
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.
Используй информацию из базы знаний для ответов на вопросы.
Отвечай вежливо, всегда на "вы", дружелюбно и профессионально.

ВАЖНЫЕ ПРАВИЛА ДЛЯ РАСПИСАНИЯ:
1. Показывай только группы ДЛЯ НАЧИНАЮЩИХ (новички, начинающие)
2. НЕ показывай группы для продолжающих, команды, PRO
3. НЕ показывай возрастные ограничения (18+, 16+ и т.д.) - это внутреннее
4. Если клиент спрашивает конкретное время - предложи связаться с администратором
5. Акцент на то, что ВСЕ могут начать с нуля

ВАЖНЫЕ ПРАВИЛА ДЛЯ ЦЕН:
1. Цены примерные, точные - у администратора
2. Всегда упоминай про скидки
3. Пробное занятие платное, но засчитывается в абонемент

СТИЛЬ ОТВЕТОВ:
• Начинай с эмодзи 🎯 📅 💰 📍
• Структурированные ответы с абзацами
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

    // Быстрые ответы на частые вопросы
    const quickResponses = {
      'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?',
      'сайт': '🌐 Наш сайт: https://cosmo.su/',
      'телефон': '📞 Телефон для записи: +7 (XXX) XXX-XX-XX',
      'адрес': '📍 Наши филиалы:\n• Дыбенко\n• Купчино\n• Звёздная\n• Озерки\n\nПодробнее: https://cosmo.su/'
    };

    for (const [key, response] of Object.entries(quickResponses)) {
      if (lowerMessage.includes(key)) {
        return res.json({ reply: response });
      }
    }

    // Если спрашивают только расписание - быстрый ответ
    if (lowerMessage.includes('расписание') && 
        (lowerMessage.includes('звезд') || lowerMessage.includes('дыбен') || 
         lowerMessage.includes('купчин') || lowerMessage.includes('озерк'))) {
      
      const schedule = await cosmoParser.getClientSchedule(branchFilter);
      let response = "📅 **Расписание CosmoDance**\n\n";
      
      Object.entries(schedule).forEach(([branch, items]) => {
        if (branch !== '_meta' && items && items.length > 0) {
          response += `📍 **${branch}**\n`;
          items.slice(0, 3).forEach(item => {
            response += `• ${item}\n`;
          });
          response += '\n';
        }
      });
      
      response += `🔗 Актуальное расписание: https://cosmo.su/raspisanie/\n`;
      response += `📞 Для точного времени: свяжитесь с администратором`;
      
      return res.json({ reply: response });
    }

    // Формируем полный контекст для AI
    const knowledgeText = buildKnowledgeText();
    const scheduleText = await getScheduleContext(branchFilter);
    const pricesText = await getPricesContext();
    
    // Сообщения для DeepSeek
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `### БАЗА ЗНАНИЙ СТУДИИ:\n${knowledgeText}` },
      { role: "system", content: `### РАСПИСАНИЕ (ТОЛЬКО ДЛЯ НАЧИНАЮЩИХ):\n${scheduleText}` },
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
    
    let errorMessage = "Извините, произошла ошибка. ";
    
    if (error.message.includes('rate limit')) {
      errorMessage = "Превышен лимит запросов. Пожалуйста, попробуйте через минуту.";
    } else if (error.message.includes('insufficient_quota')) {
      errorMessage = "Лимит запросов исчерпан на сегодня. Попробуйте завтра.";
    }
    
    // Fallback ответ
    errorMessage += "\n\n📞 Свяжитесь с нами:\n";
    errorMessage += "• Сайт: https://cosmo.su/\n";
    errorMessage += "• Расписание: https://cosmo.su/raspisanie/\n";
    errorMessage += "• Цены: https://cosmo.su/prices/\n";
    
    res.json({ reply: errorMessage });
  }
});

// API для получения расписания (клиентская версия)
app.get("/api/schedule", async (req, res) => {
  try {
    const { branch } = req.query;
    const schedule = await cosmoParser.getClientSchedule(branch);
    
    res.json({
      success: true,
      data: schedule,
      last_updated: new Date().toISOString(),
      note: 'Только группы для начинающих (очищенные названия)',
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
  const stats = cosmoParser.getStats();
  
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "2.2",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    features: {
      schedule_parser: true,
      prices_parser: true,
      ai_enabled: true,
      client_schedule: true, // Очищенное для клиентов
      knowledge_base: KNOWLEDGE.docs?.length || 0
    },
    stats: stats,
    links: {
      schedule: "https://cosmo.su/raspisanie/",
      prices: "https://cosmo.su/prices/",
      website: "https://cosmo.su/",
      chat: "/"
    }
  });
});

// ============ ЗАПУСК СЕРВЕРА ============
const port = process.env.PORT || 10000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log("=".repeat(60));
  console.log("🚀 CosmoDance Chat Bot v2.2 ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log(`🤖 AI: DeepSeek Chat (активен)`);
  console.log(`📅 Парсер расписания: АКТИВЕН (только для начинающих)`);
  console.log(`💰 Парсер цен: АКТИВЕН`);
  console.log(`🎯 Особенность: показываем только группы для новичков`);
  console.log("=".repeat(60));
  
  // Загружаем данные при старте
  console.log("🔄 Первоначальная загрузка данных...");
  Promise.all([
    cosmoParser.getClientSchedule(),
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
