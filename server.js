// server.js - CosmoDance Chat Bot v3.1 (Умный поиск)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ ИНИЦИАЛИЗАЦИЯ ============
const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));

// ============ ЗАГРУЗКА БАЗЫ ЗНАНИЙ ============
function loadKnowledge() {
  try {
    const data = fs.readFileSync("knowledge.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("❌ Ошибка загрузки knowledge.json:", error.message);
    return { 
      docs: [],
      info: {
        website: "https://cosmo.su/",
        schedule_link: "https://cosmo.su/raspisanie/",
        prices_link: "https://cosmo.su/prices/",
        contacts_link: "https://cosmo.su/contacts/"
      }
    };
  }
}

const KNOWLEDGE = loadKnowledge();
console.log(`📚 Загружено ${KNOWLEDGE.docs?.length || 0} документов из базы знаний`);

// ============ УТИЛИТЫ ДЛЯ УМНОГО ПОИСКА ============

// Функция для исправления английской раскладки
function fixEnglishLayout(text) {
  const engToRus = {
    'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г',
    'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ', 'a': 'ф', 's': 'ы',
    'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д',
    ';': 'ж', "'": 'э', 'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и',
    'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '/': '.', '`': 'ё'
  };
  
  let result = '';
  for (let char of text.toLowerCase()) {
    result += engToRus[char] || char;
  }
  return result;
}

// Функция для исправления опечаток и разговорных форм
function normalizeQuery(query) {
  let normalized = query.toLowerCase();
  
  // Сначала исправляем английскую раскладку
  normalized = fixEnglishLayout(normalized);
  
  // Заменяем разговорные формы
  const replacements = {
    'сколько стоит': ['цена', 'стоимость', 'сколько', 'стоит', 'ценник', 'прайс'],
    'пробное': ['пробник', 'попробовать', 'первое', 'начальное', 'ознакомительное'],
    'занятие': ['урок', 'тренировка', 'зал', 'класс'],
    'абонемент': ['абон', 'аб', 'карта', 'пакет', 'подписка', 'месяц'],
    'разовое': ['разовый', 'единоразово', 'одноразовое', 'одно занятие'],
    'филиал': ['студия', 'зал', 'клуб', 'школа', 'адрес', 'локация'],
    'звёздная': ['звездная', 'звезда', 'звездной', 'на звездной'],
    'дыбенко': ['дыбенка', 'на дыбенко'],
    'купчино': ['купчино', 'в купчино'],
    'озерки': ['озерков', 'в озерках'],
    'расписание': ['график', 'расписан', 'когда', 'во сколько', 'время'],
    'начать': ['старт', 'начало', 'новичок', 'с нуля', 'впервые'],
    'тренер': ['хореограф', 'преподаватель', 'инструктор', 'учитель']
  };
  
  // Добавляем синонимы в запрос
  for (const [key, synonyms] of Object.entries(replacements)) {
    if (normalized.includes(key)) {
      normalized += ' ' + synonyms.join(' ');
    }
  }
  
  return normalized;
}

// Улучшенный поиск в базе знаний
function smartSearchInKnowledge(query) {
  if (!KNOWLEDGE.docs || !Array.isArray(KNOWLEDGE.docs)) {
    return null;
  }
  
  const normalizedQuery = normalizeQuery(query);
  console.log(`🔍 Нормализованный запрос: "${normalizedQuery}"`);
  
  // Ключевые слова для категорий
  const categoryKeywords = {
    'prices': ['цена', 'стоимость', 'руб', '₽', 'абонемент', 'пробное', 'разовое', 'оплата', 'деньги'],
    'branches': ['филиал', 'адрес', 'метро', 'добраться', 'звездная', 'дыбенко', 'купчино', 'озерки'],
    'schedule': ['расписание', 'время', 'день', 'когда', 'график', 'часы'],
    'directions': ['направление', 'танец', 'хип-хоп', 'джаз', 'contemporary', 'латина', 'тверк']
  };
  
  // Сначала определяем категорию по ключевым словам
  let probableCategory = null;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => normalizedQuery.includes(keyword))) {
      probableCategory = category;
      break;
    }
  }
  
  // Ищем документы в вероятной категории
  let candidates = KNOWLEDGE.docs;
  if (probableCategory) {
    candidates = candidates.filter(doc => doc.category === probableCategory);
  }
  
  // Оцениваем релевантность каждого документа
  const scoredDocs = candidates.map(doc => {
    let score = 0;
    const docText = (doc.title + ' ' + doc.text + ' ' + (doc.tags?.join(' ') || '')).toLowerCase();
    
    // Проверяем точные совпадения в заголовке
    if (doc.title.toLowerCase().includes(normalizedQuery)) {
      score += 10;
    }
    
    // Проверяем совпадения в тексте
    const queryWords = normalizedQuery.split(' ').filter(word => word.length > 2);
    queryWords.forEach(word => {
      if (docText.includes(word)) {
        score += 2;
      }
    });
    
    // Дополнительные баллы за теги
    if (doc.tags) {
      doc.tags.forEach(tag => {
        if (normalizedQuery.includes(tag.toLowerCase())) {
          score += 3;
        }
      });
    }
    
    // Дополнительные баллы за категорию
    if (doc.category === probableCategory) {
      score += 5;
    }
    
    return { doc, score };
  });
  
  // Сортируем по убыванию релевантности
  scoredDocs.sort((a, b) => b.score - a.score);
  
  // Возвращаем самый релевантный документ
  if (scoredDocs.length > 0 && scoredDocs[0].score > 0) {
    console.log(`✅ Найден документ: "${scoredDocs[0].doc.title}" (оценка: ${scoredDocs[0].score})`);
    return scoredDocs[0].doc;
  }
  
  return null;
}

// ============ КОСВЕННЫЕ ЗАПРОСЫ ============
function handleIndirectQuery(query) {
  const normalized = normalizeQuery(query);
  
  // Косвенные запросы о ценах
  const pricePatterns = [
    {
      patterns: ['сколько', 'стоит', 'первый', 'раз', 'впервые', 'попробовать'],
      response: '💎 **Пробное занятие:** 400 ₽ (становится бесплатным при покупке абонемента)'
    },
    {
      patterns: ['разов', 'один', 'раз', 'без абонемент', 'просто попробовать'],
      response: '🎫 **Разовое занятие:** 900 ₽ (без абонемента)'
    },
    {
      patterns: ['абонемент', 'на месяц', 'ежемесяч', 'подписк'],
      response: '📅 **Абонементы на 1 месяц (60 минут):**\n• 4 занятия — 3 290 ₽\n• 8 занятий — 4 990 ₽\n• Безлимит — 11 500 ₽'
    },
    {
      patterns: ['8 занятий', 'восемь', '8 раз'],
      response: '📊 **Абонемент на 8 занятий (60 минут):** 4 990 ₽ на 1 месяц'
    },
    {
      patterns: ['индивидуальн', 'персональн', 'с тренером', 'один на один'],
      response: '👤 **Индивидуальные занятия:** от 2 200 ₽ (точная стоимость у администратора)'
    },
    {
      patterns: ['детск', 'ребенок', 'школьник'],
      response: '👧 **Для детей:** цены как для взрослых + дневник танцора в подарок!'
    }
  ];
  
  // Косвенные запросы о филиалах
  const branchPatterns = [
    {
      patterns: ['звездн', 'star', 'метро звезд'],
      response: '📍 **Филиал на Звёздной:** м. Звёздная, 5-7 минут пешком'
    },
    {
      patterns: ['дыбенк', 'dybenko', 'проспект большевиков'],
      response: '📍 **Филиал на Дыбенко:** м. Проспект Большевиков, удобная парковка'
    },
    {
      patterns: ['купчин', 'kupchino'],
      response: '📍 **Филиал в Купчино:** м. Купчино, современное оборудование'
    },
    {
      patterns: ['озерк', 'ozerki'],
      response: '📍 **Филиал в Озерках:** м. Озерки, светлые залы'
    }
  ];
  
  // Проверяем паттерны цен
  for (const pattern of pricePatterns) {
    if (pattern.patterns.some(p => normalized.includes(p))) {
      return pattern.response;
    }
  }
  
  // Проверяем паттерны филиалов
  for (const pattern of branchPatterns) {
    if (pattern.patterns.some(p => normalized.includes(p))) {
      return pattern.response;
    }
  }
  
  return null;
}

// ============ ЛОКАЛЬНЫЕ ОТВЕТЫ (упрощенные) ============
const LOCAL_RESPONSES = {
  // Только самые базовые приветствия
  'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?',
  'здравствуйте': '👋 Здравствуйте! Я ассистент студии CosmoDance.',
  'добрый день': '👋 Добрый день! Рад вас видеть!',
  'доброе утро': '👋 Доброе утро! Готов ответить на ваши вопросы.',
  'добрый вечер': '👋 Добрый вечер! Чем могу помочь?',
  'start': '🎯 **Добро пожаловать в CosmoDance!**\n\nЯ помогу вам узнать:\n• Цены и абонементы\n• Расписание занятий\n• Адреса филиалов\n• Направления танцев\n\nЧто вас интересует?',
  
  // Только ссылки (без деталей)
  'сайт': `🌐 **Наш сайт:** ${KNOWLEDGE.info?.website || 'https://cosmo.su/'}`,
  'расписание': `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}`,
  'контакты': `📞 **Контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}`,
  
  // Филиалы (минимум)
  'филиалы': '📍 **Наши филиалы:**\n1. Звёздная (м. Звёздная)\n2. Дыбенко (м. Пр. Большевиков)\n3. Купчино (м. Купчино)\n4. Озерки (м. Озерки)\n\n🔗 **Подробнее:** https://cosmo.su/contacts/',
  
  // Только начало (без цен)
  'начать': '🎯 **Как начать:**\n1. Выберите направление\n2. Найдите филиал\n3. Посмотрите расписание\n4. Запишитесь на пробное\n\n📅 Расписание: https://cosmo.su/raspisanie/',
  
  'направлен': '💃 **Направления:** Hip-Hop, Jazz Funk, Contemporary, High Heels, Latina, Twerk, Strip Dance, Break Dance\n🔗 Подробнее: https://cosmo.su/directions/'
};

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

    console.log(`📨 Запрос: "${userMessage}"`);
    console.log(`🔄 Исходный: "${userMessage.toLowerCase()}"`);
    console.log(`🔧 Нормализованный: "${normalizeQuery(userMessage)}"`);
    
    const lowerMessage = userMessage.toLowerCase();
    
    // 1. Проверяем только базовые локальные ответы (приветствия и ссылки)
    const basicKeys = ['привет', 'здравствуйте', 'добрый', 'start', 'сайт', 'расписание', 'контакты', 'филиалы', 'начать', 'направлен'];
    for (const key of basicKeys) {
      if (lowerMessage.includes(key)) {
        return res.json({ 
          reply: LOCAL_RESPONSES[key] || LOCAL_RESPONSES['привет'],
          source: "basic_response"
        });
      }
    }
    
    // 2. Обрабатываем косвенные запросы
    const indirectResponse = handleIndirectQuery(userMessage);
    if (indirectResponse) {
      console.log(`✅ Косвенный запрос обработан`);
      return res.json({
        reply: indirectResponse,
        source: "indirect_query"
      });
    }
    
    // 3. Умный поиск в базе знаний
    const knowledgeMatch = smartSearchInKnowledge(userMessage);
    if (knowledgeMatch) {
      console.log(`✅ Найдено в базе знаний: "${knowledgeMatch.title}"`);
      
      let response = '';
      
      // Форматируем ответ
      if (knowledgeMatch.category === 'prices') {
        response = `💰 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}\n\n`;
        if (knowledgeMatch.id === 'trial_lesson') {
          response += '🎯 **Идеально, чтобы попробовать перед покупкой абонемента!**';
        } else if (knowledgeMatch.id === 'single_lesson') {
          response += '💡 **Выгоднее купить абонемент!**';
        }
        response += `\n\n💎 **Актуальные цены всегда на сайте:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
      } else if (knowledgeMatch.category === 'branches') {
        response = `📍 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}\n\n`;
        response += `🔗 **Точный адрес и контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}`;
      } else {
        response = `🎯 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}`;
      }
      
      return res.json({
        reply: response,
        source: "knowledge_base"
      });
    }
    
    // 4. Если ничего не найдено, предлагаем уточнить
    const suggestions = [
      "💰 **О ценах:** 'Сколько стоит пробное занятие?' или 'Какие есть абонементы?'",
      "📍 **О филиалах:** 'Как добраться до Звёздной?' или 'Где находится филиал на Дыбенко?'",
      "📅 **О занятиях:** 'Какие группы для начинающих?' или 'Когда занятия по Hip-Hop?'",
      "💃 **О направлениях:** 'Какие танцы есть для новичков?' или 'Что такое Contemporary?'"
    ];
    
    const randomSuggestions = suggestions
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .join('\n\n');
    
    const generalResponse = `🎯 **CosmoDance**\n\n` +
      `Не совсем понял ваш вопрос. Попробуйте спросить иначе:\n\n` +
      `${randomSuggestions}\n\n` +
      `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
      `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n` +
      `📍 **Контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}`;
    
    return res.json({
      reply: generalResponse,
      source: "help_suggestions"
    });

  } catch (error) {
    console.error("❌ Ошибка обработки:", error.message);
    
    res.json({ 
      reply: `🎯 **CosmoDance**\n\n` +
             `📍 **Филиалы:** Звёздная, Дыбенко, Купчино, Озерки\n` +
             `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
             `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n` +
             `🌐 **Сайт:** ${KNOWLEDGE.info?.website || 'https://cosmo.su/'}`,
      error: true,
      source: "fallback"
    });
  }
});

// Тестовый маршрут для проверки нормализации
app.get("/test-query", (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ error: "Нет запроса" });
  }
  
  res.json({
    original: q,
    normalized: normalizeQuery(q),
    english_fixed: fixEnglishLayout(q),
    indirect_result: handleIndirectQuery(q),
    knowledge_match: smartSearchInKnowledge(q)?.title || "не найдено"
  });
});

// Остальные маршруты (health, api/knowledge и т.д.) остаются без изменений
// ... [копируйте их из предыдущей версии] ...

// Статистика
app.get("/health", (req, res) => {
  const categories = [...new Set(KNOWLEDGE.docs?.map(d => d.category).filter(Boolean))];
  
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "3.1",
    timestamp: new Date().toISOString(),
    features: {
      smart_search: true,
      english_layout_fix: true,
      indirect_queries: true,
      knowledge_docs: KNOWLEDGE.docs?.length || 0
    },
    examples: {
      prices: "Сколько стоит пробное? (или Cnjktxcf rjhyz?)",
      branches: "Как доехать до звездной? (или Rfr ljtr;lq nj pfclyz?)",
      schedule: "Когда занятия? (или Rjtym pfotybwf?)"
    }
  });
});

// ============ ЗАПУСК СЕРВЕРА ============
const port = process.env.PORT || 10000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log("=".repeat(60));
  console.log("🚀 CosmoDance Chat Bot v3.1 ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log("=".repeat(60));
  console.log("✨ **Умные функции:**");
  console.log("• Понимает косвенные запросы");
  console.log("• Исправляет английскую раскладку");
  console.log("• Ищет в базе знаний по смыслу");
  console.log("• Отвечает на разговорную речь");
  console.log("=".repeat(60));
});

process.on('SIGTERM', () => {
  console.log('🔄 Получен SIGTERM, завершаем работу...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Получен SIGINT, завершаем работу...');
  process.exit(0);
});
