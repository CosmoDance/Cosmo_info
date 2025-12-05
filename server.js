// server.js - CosmoDance Chat Bot v2.3
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
let aiClient = null;
try {
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length > 20) {
    aiClient = new DeepSeekAI(process.env.DEEPSEEK_API_KEY);
    console.log('🤖 DeepSeek AI инициализирован');
  } else {
    console.log('⚠️ DeepSeek API ключ не настроен или слишком короткий');
  }
} catch (error) {
  console.error('❌ Ошибка инициализации AI:', error.message);
}

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
console.log(`📚 Загружено ${KNOWLEDGE.docs?.length || 0} документов из базы знаний`);

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
    const schedule = await cosmoParser.getClientSchedule(branch);
    
    if (!schedule || Object.keys(schedule).filter(k => !k.startsWith('_')).length === 0) {
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
    scheduleText += "🎯 **Все могут начать с нуля!**\n";
    scheduleText += "📅 **Актуальное расписание:** https://cosmo.su/raspisanie/\n";
    scheduleText += "📞 **Запись на занятия:** свяжитесь с администратором\n";

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

// ============ СИСТЕМНЫЙ ПРОМПТ ============
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.
Используй информацию из базы знаний для ответов на вопросы.
Отвечай вежливо, всегда на "вы", дружелюбно и профессионально.

ВАЖНЫЕ ПРАВИЛА:
1. Показывай только группы ДЛЯ НАЧИНАЮЩИХ
2. Цены примерные, точные - у администратора
3. Всегда упоминай про скидки
4. Пробное занятие платное, но засчитывается в абонемент

СТИЛЬ ОТВЕТОВ:
• Начинай с эмодзи 🎯 📅 💰 📍
• Структурированные ответы с абзацами
• Поддержка и мотивация для новичков
• Четкие следующий шаги (запись, консультация)`;

// ============ МАРШРУТЫ API ============

// Главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Диагностика
app.get("/debug", async (req, res) => {
  try {
    // Проверяем парсер
    let parserStatus = { success: false, error: null };
    try {
      const testSchedule = await cosmoParser.getClientSchedule();
      parserStatus.success = true;
      parserStatus.branches = Object.keys(testSchedule).filter(k => !k.startsWith('_'));
      parserStatus.items = parserStatus.branches.reduce((sum, b) => {
        return sum + (testSchedule[b]?.length || 0);
      }, 0);
    } catch (error) {
      parserStatus.error = error.message;
    }
    
    // Проверяем AI
    let aiStatus = { success: false, error: null };
    if (aiClient) {
      try {
        const testResponse = await aiClient.chat([
          { role: "user", content: "Привет" }
        ], { maxTokens: 10 });
        aiStatus.success = true;
      } catch (error) {
        aiStatus.error = error.message;
      }
    }
    
    res.json({
      status: "diagnostics",
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 10000,
        HOST: process.env.HOST || '0.0.0.0',
        DEEPSEEK_KEY_LENGTH: process.env.DEEPSEEK_API_KEY?.length || 0
      },
      parser: parserStatus,
      ai: aiStatus,
      knowledge_base: {
        docs_count: KNOWLEDGE.docs?.length || 0
      },
      suggestions: [
        parserStatus.success ? "✅ Парсер работает" : "❌ Парсер не работает: " + parserStatus.error,
        aiClient ? "✅ AI доступен" : "❌ AI не доступен (нет API ключа)",
        aiStatus.success ? "✅ AI отвечает" : "❌ AI не отвечает: " + aiStatus.error
      ]
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Тест соединения с сайтом
app.get("/test-connection", async (req, res) => {
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get('https://cosmo.su', {
      timeout: 5000,
      headers: {
        'User-Agent': 'CosmoDanceBot-Test/1.0'
      }
    });
    
    res.json({
      success: true,
      status: response.status,
      size: response.data.length,
      firstLine: response.data.split('\n')[0]
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
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

    console.log(`📨 Запрос: "${userMessage}"`);

    // РАСШИРЕННЫЕ ЛОКАЛЬНЫЕ ОТВЕТЫ
    const enhancedResponses = {
      // Приветствия
      'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?',
      'здравствуйте': '👋 Здравствуйте! Я ассистент студии CosmoDance.',
      'добрый день': '👋 Добрый день! Рад вас видеть в студии CosmoDance!',
      'доброе утро': '👋 Доброе утро! Готов ответить на ваши вопросы.',
      'добрый вечер': '👋 Добрый вечер! Чем могу помочь?',
      
      // Основная информация
      'сайт': '🌐 **Наш сайт:** https://cosmo.su/\n' +
             'Здесь найдете:\n' +
             '• Расписание занятий\n' +
             '• Цены и абонементы\n' +
             '• Контакты филиалов\n' +
             '• Фото и видео с занятий',
      
      'расписание': '📅 **Расписание CosmoDance:**\n\n' +
                   '🎯 **Группы для начинающих** есть каждый день!\n\n' +
                   '📍 **Филиалы:**\n' +
                   '• Звёздная\n' +
                   '• Дыбенко\n' +
                   '• Купчино\n' +
                   '• Озерки\n\n' +
                   '🔗 **Актуальное расписание:** https://cosmo.su/raspisanie/\n' +
                   '📞 **Запись:** свяжитесь с администратором',
      
      'цены': '💰 **Цены CosmoDance:**\n\n' +
             '🎫 **Абонементы:**\n' +
             '• 4 занятия: 3500-4500₽\n' +
             '• 8 занятий: 6000-8000₽\n' +
             '• 12 занятий: 8500-10000₽\n\n' +
             '🎁 **Скидки:** студентам, семейным парам\n' +
             '💎 **Пробное занятие:** 1000₽\n\n' +
             '🔗 **Все цены:** https://cosmo.su/prices/',
      
      // ЦЕНЫ И АБОНЕМЕНТЫ
      'сколько стоит': '💰 **Стоимость занятий в CosmoDance:**\n\n' +
                      '🎯 **Для НАЧИНАЮЩИХ:**\n' +
                      '• Абонемент 8 занятий: 6000-8000₽\n' +
                      '• Разовое занятие: 1000-1500₽\n' +
                      '• Пробное занятие: 1000₽ (засчитывается в абонемент)\n\n' +
                      '🏆 **Выгоднее всего:**\n' +
                      '• Купить абонемент на 12 занятий\n' +
                      '• Привести друга (скидка 10% обоим)\n' +
                      '• Семейная скидка 15%\n\n' +
                      '📞 **Точную стоимость** уточняйте у администратора',
      
      'абонемент': '🎫 **Абонементы CosmoDance:**\n\n' +
                  'У нас есть несколько вариантов:\n\n' +
                  '1. **На 4 занятия** - для тех, кто хочет попробовать\n' +
                  '2. **На 8 занятий** - оптимальный вариант\n' +
                  '3. **На 12 занятий** - максимальная выгода\n\n' +
                  '💰 **Цены:**\n' +
                  '• 4 занятия: от 3500₽\n' +
                  '• 8 занятий: от 6000₽\n' +
                  '• 12 занятий: от 8500₽\n\n' +
                  '⏰ **Срок действия:** 30 дней\n' +
                  '❄️ **Можно заморозить** на 14 дней\n\n' +
                  '🔗 **Подробнее:** https://cosmo.su/prices/',
      
      // Филиалы
      'адрес': '📍 **Наши филиалы в Санкт-Петербурге:**\n\n' +
              '1. **Звёздная**\n' +
              '   • Адрес: ул. Звёздная\n' +
              '   • Метро: Звёздная\n' +
              '2. **Дыбенко**\n' +
              '   • Адрес: ул. Дыбенко\n' +
              '   • Метро: Проспект Большевиков\n' +
              '3. **Купчино**\n' +
              '   • Адрес: район Купчино\n' +
              '   • Метро: Купчино\n' +
              '4. **Озерки**\n' +
              '   • Адрес: район Озерки\n' +
              '   • Метро: Озерки\n\n' +
              '🔗 **Точные адреса:** https://cosmo.su/contacts/',
      
      'телефон': '📞 **Контакты CosmoDance:**\n\n' +
                '**Запись на занятия:**\n' +
                '• Телефон: +7 (XXX) XXX-XX-XX\n' +
                '• WhatsApp: +7 (XXX) XXX-XX-XX\n' +
                '• Telegram: @cosmodance_bot\n\n' +
                '🔗 **Все контакты:** https://cosmo.su/contacts/',
      
      // Начало занятий
      'начать': '🎯 **Как начать танцевать в CosmoDance:**\n\n' +
               '1. **Выберите направление** которое вам нравится\n' +
               '2. **Найдите ближайший филиал**\n' +
               '3. **Посмотрите расписание** для начинающих\n' +
               '4. **Запишитесь на пробное занятие** (1000₽)\n' +
               '5. **Приходите на занятие** в удобной одежде\n\n' +
               '📅 **Расписание:** https://cosmo.su/raspisanie/\n' +
               '💰 **Цены:** https://cosmo.su/prices/',
      
      'новичок': '🎯 **Для новичков в CosmoDance:**\n\n' +
                '✅ **Не нужно никакой подготовки!**\n' +
                '✅ **Все начинают с нуля**\n' +
                '✅ **Индивидуальный подход** к каждому\n' +
                '✅ **Дружелюбная атмосфера**\n\n' +
                '🔥 **Популярные направления для начинающих:**\n' +
                '• Hip-Hop\n' +
                '• Jazz Funk\n' +
                '• High Heels\n' +
                '• Latina\n' +
                '• Twerk\n\n' +
                '📅 **Выберите направление и приходите!**',
      
      // Запись
      'записаться': '📝 **Как записаться на занятия:**\n\n' +
                   '**Способы записи:**\n' +
                   '1. **На сайте:** https://cosmo.su/ (форма записи)\n' +
                   '2. **По телефону:** +7 (XXX) XXX-XX-XX\n' +
                   '3. **В соцсетях:** Instagram, VK\n' +
                   '4. **В студии:** приходите лично\n\n' +
                   '🎯 **Перед записью:**\n' +
                   '• Посмотрите расписание\n' +
                   '• Выберите удобный филиал\n' +
                   '• Определитесь с направлением\n\n' +
                   '📅 **Расписание:** https://cosmo.su/raspisanie/',
      
      // Направления
      'направлен': '💃 **Направления танцев в CosmoDance:**\n\n' +
                  '🎯 **Для начинающих:**\n' +
                  '• Hip-Hop (хип-хоп)\n' +
                  '• Jazz Funk (джаз-фанк)\n' +
                  '• Contemporary (контемпорари)\n' +
                  '• High Heels (высокие каблуки)\n' +
                  '• Latina (латина)\n' +
                  '• Twerk (тверк)\n' +
                  '• Strip Dance (стрип-пластика)\n' +
                  '• Break Dance (брейк-данс)\n\n' +
                  '📅 **Все направления:** https://cosmo.su/directions/',
      
      // Дни и время
      'когда': '⏰ **Когда проходят занятия:**\n\n' +
              'Занятия проходят **каждый день** в разное время:\n\n' +
              '• **Утренние:** с 9:00 до 12:00\n' +
              '• **Дневные:** с 14:00 до 17:00\n' +
              '• **Вечерние:** с 18:00 до 22:00\n\n' +
              '🎯 **Для начинающих** чаще всего вечерние группы.\n' +
              '📅 **Точное расписание:** https://cosmo.su/raspisanie/',
      
      // Что нужно
      'что нужно': '🎒 **Что нужно для первого занятия:**\n\n' +
                  '1. **Одежда:** удобная, не сковывающая движения\n' +
                  '2. **Обувь:** чешки, кроссовки или носки\n' +
                  '3. **Вода:** бутылка с водой\n' +
                  '4. **Полотенце:** можно взять с собой\n' +
                  '5. **Хорошее настроение!**\n\n' +
                  '💎 **Все остальное предоставляет студия.**',
      
      // Тренеры
      'тренер': '👨‍🏫 **Наши тренеры:**\n\n' +
               '• Профессиональные хореографы\n' +
               '• Опыт работы от 5 лет\n' +
               '• Участие в чемпионатах\n' +
               '• Индивидуальный подход\n\n' +
               '🔥 **Все тренеры** специализируются на работе с новичками!\n' +
               '🔗 **Подробнее о тренерах:** https://cosmo.su/trainers/'
    };

    // Проверяем локальные ответы
    const lowerMessage = userMessage.toLowerCase();
    for (const [key, response] of Object.entries(enhancedResponses)) {
      if (lowerMessage.includes(key) && key.length > 3) {
        console.log(`✅ Используем локальный ответ для: ${key}`);
        return res.json({ 
          reply: response,
          source: "local_response"
        });
      }
    }

    // Если AI не настроен, возвращаем общий ответ
    if (!aiClient) {
      return res.json({
        reply: "🎯 **Студия танцев CosmoDance**\n\n" +
               "📍 **Филиалы:** Звёздная, Дыбенко, Купчино, Озерки\n" +
               "📅 **Расписание:** https://cosmo.su/raspisanie/\n" +
               "💰 **Цены:** https://cosmo.su/prices/\n" +
               "🌐 **Сайт:** https://cosmo.su/\n\n" +
               "📞 **Свяжитесь с администратором для записи и консультации.**",
        source: "fallback_no_ai"
      });
    }

    // Формируем контекст для AI
    const knowledgeText = buildKnowledgeText();
    const scheduleText = await getScheduleContext();
    const pricesText = await getPricesContext();
    
    // Сообщения для DeepSeek
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `### БАЗА ЗНАНИЙ СТУДИИ:\n${knowledgeText}` },
      { role: "system", content: `### РАСПИСАНИЕ:\n${scheduleText}` },
      { role: "system", content: `### ЦЕНЫ И АБОНЕМЕНТЫ:\n${pricesText}` },
      { role: "user", content: userMessage }
    ];

    // Вызов DeepSeek API
    const result = await aiClient.chat(messages, {
      temperature: 0.7,
      maxTokens: 800
    });

    console.log(`✅ AI ответ сформирован (${result.usage?.total_tokens || '?'} токенов)`);

    res.json({ 
      reply: result.content,
      tokens: result.usage?.total_tokens || 0,
      source: "deepseek_ai"
    });

  } catch (error) {
    console.error("❌ Ошибка обработки запроса:", error.message);
    
    // Fallback ответ
    res.json({ 
      reply: `🎯 **Студия танцев CosmoDance**\n\n` +
             `📍 **Филиалы:** Звёздная, Дыбенко, Купчино, Озерки\n` +
             `📅 **Расписание:** https://cosmo.su/raspisanie/\n` +
             `💰 **Цены:** https://cosmo.su/prices/\n` +
             `🌐 **Сайт:** https://cosmo.su/\n\n` +
             `📞 **Свяжитесь с нами для записи и консультации.**`,
      error: error.message,
      source: "error_fallback"
    });
  }
});

// API для получения расписания
app.get("/api/schedule", async (req, res) => {
  try {
    const { branch } = req.query;
    const schedule = await cosmoParser.getClientSchedule(branch);
    
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
    version: "2.3",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    api_key_configured: !!process.env.DEEPSEEK_API_KEY,
    features: {
      schedule_parser: true,
      prices_parser: true,
      ai_enabled: !!process.env.DEEPSEEK_API_KEY,
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

// Очистка кэша парсера
app.post("/admin/clear-cache", async (req, res) => {
  try {
    cosmoParser.clearCache();
    res.json({
      success: true,
      message: "Кэш парсера очищен"
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
  console.log("🚀 CosmoDance Chat Bot v2.3 ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log(`🔑 API ключ: ${process.env.DEEPSEEK_API_KEY ? 'настроен' : 'ОТСУТСТВУЕТ!'}`);
  console.log("=".repeat(60));
  
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("⚠️ ВНИМАНИЕ: API ключ DeepSeek не настроен!");
    console.log("⚠️ Бот будет использовать только локальные ответы");
  }
  
  // Предварительная загрузка данных
  console.log("🔄 Предварительная загрузка данных...");
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
