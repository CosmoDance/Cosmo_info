// server.js - CosmoDance Chat Bot v4.0 (Умный бот с полным пониманием)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Импортируем модули
import IntelligentMatcher from "./intelligent-matcher.js";
import { findDirection, getAvailableDirections, getPopularDirections } from "./dance-directions.js";

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
        contacts_link: "https://cosmo.su/contacts/",
        directions_link: "https://cosmo.su/directions/",
        trainers_link: "https://cosmo.su/trainers/"
      }
    };
  }
}

const KNOWLEDGE = loadKnowledge();
console.log(`📚 Загружено ${KNOWLEDGE.docs?.length || 0} документов из базы знаний`);

// ============ ИНИЦИАЛИЗАЦИЯ МАТЧЕРА ============
const matcher = new IntelligentMatcher(KNOWLEDGE);

// ============ УТИЛИТЫ ============

// Исправление английской раскладки
function fixEnglishLayout(text) {
  const engToRus = {
    'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г',
    'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ', 'a': 'ф', 's': 'ы',
    'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д',
    ';': 'ж', "'": 'э', 'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и',
    'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '/': '.', '`': 'ё',
    '@': '"', '#': '№', '$': ';', '^': ':', '&': '?'
  };
  
  let result = '';
  for (let char of text.toLowerCase()) {
    result += engToRus[char] || char;
  }
  return result;
}

// Проверка на английскую раскладку
function isEnglishLayout(text) {
  const englishLetters = text.match(/[a-z]/gi);
  const russianLetters = text.match(/[а-яё]/gi);
  
  if (!englishLetters) return false;
  if (!russianLetters) return englishLetters.length > 3;
  
  const englishRatio = englishLetters.length / (englishLetters.length + russianLetters.length);
  return englishRatio > 0.3;
}

// Поиск в базе знаний
function searchInKnowledge(query) {
  if (!KNOWLEDGE.docs || !Array.isArray(KNOWLEDGE.docs)) {
    return null;
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Ищем точные совпадения
  const exactMatch = KNOWLEDGE.docs.find(doc => 
    doc.title && doc.title.toLowerCase().includes(lowerQuery)
  );
  
  if (exactMatch) return exactMatch;
  
  // Ищем в тексте
  const textMatch = KNOWLEDGE.docs.find(doc => 
    doc.text && doc.text.toLowerCase().includes(lowerQuery)
  );
  
  if (textMatch) return textMatch;
  
  // Ищем по тегам
  const tagMatch = KNOWLEDGE.docs.find(doc => 
    doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
  
  return tagMatch || null;
}

// ============ ОБРАБОТЧИКИ ОТВЕТОВ ============

// Обработчик для категории ЦЕНЫ
function handlePricesCategory(query) {
  const normalizedQuery = query.toLowerCase();
  
  // Пробное занятие
  if (matcher.isQueryInCategory(query, 'trial')) {
    return `💎 **Пробное занятие:**\n\n` +
           `• Стоимость: 400 ₽\n` +
           `• Это первое посещение любого направления\n` +
           `• При покупке абонемента становится БЕСПЛАТНЫМ\n\n` +
           `🎯 **Идеально, чтобы попробовать перед покупкой абонемента!**\n\n` +
           `🔗 **Все цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
  }
  
  // Разовое занятие
  if (matcher.isQueryInCategory(query, 'single')) {
    return `🎫 **Разовое занятие:**\n\n` +
           `• Стоимость: 900 ₽\n` +
           `• Разовое посещение без абонемента\n` +
           `• Идеально, если хотите просто попробовать\n\n` +
           `💡 **Выгоднее купить абонемент!**\n\n` +
           `🔗 **Все цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
  }
  
  // Абонементы
  if (matcher.isQueryInCategory(query, 'abonement')) {
    if (normalizedQuery.includes('8') || normalizedQuery.includes('восемь')) {
      return `📊 **Абонемент на 8 занятий:**\n\n` +
             `**На 60 минут:**\n` +
             `• 8 занятий — 4 990 ₽\n` +
             `• Срок: 1 месяц\n\n` +
             `**На 85 минут:**\n` +
             `• 8 занятий — 6 500 ₽\n` +
             `• Срок: 1 месяц\n\n` +
             `🎯 **Самый популярный вариант!**\n\n` +
             `🔗 **Все абонементы:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
    }
    
    if (normalizedQuery.includes('4') || normalizedQuery.includes('четыре')) {
      return `📦 **Абонемент на 4 занятия:**\n\n` +
             `**На 60 минут:**\n` +
             `• 4 занятия — 3 290 ₽\n` +
             `• Срок: 1 месяц\n\n` +
             `**На 85 минут:**\n` +
             `• 4 занятия — 3 950 ₽\n` +
             `• Срок: 1 месяц\n\n` +
             `💡 **Отлично для новичков!**\n\n` +
             `🔗 **Все абонементы:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
    }
    
    return `💰 **Абонементы CosmoDance:**\n\n` +
           `**На 60 минут (1 час):**\n` +
           `• 4 занятия — 3 290 ₽ (1 месяц)\n` +
           `• 8 занятий — 4 990 ₽ (1 месяц)\n` +
           `• 12 занятий — 6 500 ₽ (1 месяц)\n` +
           `• 24 занятия — 12 590 ₽ (3,5 месяца)\n` +
           `• 48 занятий — 22 900 ₽ (6,5 месяца)\n` +
           `• Безлимит — 11 500 ₽ (1 месяц)\n\n` +
           `**На 85 минут (1,5 часа):**\n` +
           `• 4 занятия — 3 950 ₽ (1 месяц)\n` +
           `• 8 занятий — 6 500 ₽ (1 месяц)\n` +
           `• 12 занятий — 9 200 ₽ (2 месяца)\n` +
           `• 24 занятия — 17 200 ₽ (3,5 месяца)\n` +
           `• 48 занятий — 31 650 ₽ (6,5 месяца)\n\n` +
           `💎 **Пробное занятие: 400 ₽ (бесплатно при покупке абонемента)**\n\n` +
           `🔗 **Актуальные цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
  }
  
  // Безлимит
  if (matcher.isQueryInCategory(query, 'unlimited')) {
    return `∞ **Безлимитный абонемент:**\n\n` +
           `• Стоимость: 11 500 ₽\n` +
           `• Срок: 1 месяц\n` +
           `• Неограниченное количество посещений\n\n` +
           `🎯 **Идеально, если планируете ходить чаще 3 раз в неделю!**\n\n` +
           `🔗 **Подробнее:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
  }
  
  // Индивидуальные занятия
  if (matcher.isQueryInCategory(query, 'individual')) {
    return `👤 **Индивидуальные занятия:**\n\n` +
           `• Стоимость: от 2 200 ₽\n` +
           `• Цена зависит от направления и хореографа\n` +
           `• Точную стоимость сообщает администратор\n\n` +
           `💎 **Персональный подход и максимальный результат!**\n\n` +
           `📞 **Запись:** свяжитесь с администратором`;
  }
  
  // Скидки
  if (matcher.isQueryInCategory(query, 'discounts')) {
    return `🎁 **Скидки и акции:**\n\n` +
           `• Студентам: -15%\n` +
           `• Семейным парам: -20%\n` +
           `• Приведи друга: -10% обоим\n` +
           `• При покупке 2+ абонементов: -15%\n\n` +
           `💎 **Дополнительно:**\n` +
           `• При покупке абонемента пробное занятие бесплатно\n` +
           `• Для детей — дневник танцора в подарок\n\n` +
           `🔗 **Актуальные акции:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
  }
  
  // Общий ответ о ценах
  return `💰 **Цены CosmoDance:**\n\n` +
         `🎯 **Основные тарифы:**\n` +
         `• Пробное занятие: 400 ₽\n` +
         `• Разовое занятие: 900 ₽\n` +
         `• Абонемент 8 занятий: 4 990 ₽\n` +
         `• Безлимит: 11 500 ₽\n\n` +
         `💡 **Все цены едины для всех направлений!**\n\n` +
         `✅ **Что входит в цену:**\n` +
         `• Профессиональные тренеры\n` +
         `• Современные залы\n` +
         `• Все необходимое оборудование\n` +
         `• Дружелюбная атмосфера\n\n` +
         `🔗 **Подробнее о ценах:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
}

// Обработчик для категории РАСПИСАНИЕ
function handleScheduleCategory(query) {
  const normalizedQuery = query.toLowerCase();
  
  // Определяем филиал
  let branch = '';
  if (normalizedQuery.includes('звездн')) branch = 'Звёздная';
  else if (normalizedQuery.includes('дыбенк')) branch = 'Дыбенко';
  else if (normalizedQuery.includes('купчин')) branch = 'Купчино';
  else if (normalizedQuery.includes('озерк')) branch = 'Озерки';
  
  if (branch) {
    return `📅 **Расписание в филиале "${branch}":**\n\n` +
           `🎯 **Группы для начинающих:**\n` +
           `• Есть утренние, дневные и вечерние группы\n` +
           `• Занятия проходят каждый день\n` +
           `• Длительность: 60 или 85 минут\n\n` +
           `📍 **Как узнать точное расписание:**\n` +
           `1. Перейдите на страницу расписания\n` +
           `2. Выберите филиал "${branch}"\n` +
           `3. Найдите группы с пометкой "новички" или "начальный"\n\n` +
           `🔗 **Актуальное расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}`;
  }
  
  // Общий ответ о расписании
  return `📅 **Расписание занятий CosmoDance:**\n\n` +
         `🎯 **Для начинающих:**\n` +
         `• Занятия проходят КАЖДЫЙ ДЕНЬ\n` +
         `• Утренние группы: 9:00 - 12:00\n` +
         `• Дневные группы: 14:00 - 17:00\n` +
         `• Вечерние группы: 18:00 - 22:00\n\n` +
         `📍 **Филиалы:**\n` +
         `• Звёздная (м. Звёздная)\n` +
         `• Дыбенко (м. Пр. Большевиков)\n` +
         `• Купчино (м. Купчино)\n` +
         `• Озерки (м. Озерки)\n\n` +
         `💡 **Совет:** Всегда проверяйте актуальное расписание на сайте!\n\n` +
         `🔗 **Расписание на сайте:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}`;
}

// Обработчик для категории ФИЛИАЛЫ
function handleBranchesCategory(query) {
  const normalizedQuery = query.toLowerCase();
  
  // Звёздная
  if (normalizedQuery.includes('звездн')) {
    return `📍 **Филиал на Звёздной:**\n\n` +
           `🚇 **Метро:** Звёздная\n` +
           `• 5-7 минут пешком от выхода из метро\n` +
           `• Современные залы с зеркалами\n` +
           `• Раздевалки и душевые\n` +
           `• Все группы для начинающих\n\n` +
           `🎯 **Популярные направления в этом филиале:**\n` +
           `• Hip-Hop\n` +
           `• Jazz Funk\n` +
           `• High Heels\n` +
           `• Contemporary\n\n` +
           `🔗 **Точный адрес и контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/#zvezdnaya'}\n` +
           `📅 **Расписание этого филиала:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}`;
  }
  
  // Дыбенко
  if (normalizedQuery.includes('дыбенк')) {
    return `📍 **Филиал на Дыбенко:**\n\n` +
           `🚇 **Метро:** Проспект Большевиков\n` +
           `• Удобное расположение\n` +
           `• Большие залы\n` +
           `• Парковка рядом\n` +
           `• Современное оборудование\n\n` +
           `🎯 **Популярные направления в этом филиале:**\n` +
           `• Hip-Hop\n` +
           `• Break Dance\n` +
           `• Contemporary\n` +
           `• Latina\n\n` +
           `🔗 **Точный адрес и контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/#dybenko'}\n` +
           `📅 **Расписание этого филиала:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}`;
  }
  
  // Общий ответ о филиалах
  return `📍 **Наши филиалы в Санкт-Петербурге:**\n\n` +
         `1. **Звёздная**\n` +
         `   • Метро: Звёздная\n` +
         `   • 5-7 минут пешком\n` +
         `   • Все группы для начинающих\n\n` +
         `2. **Дыбенко**\n` +
         `   • Метро: Проспект Большевиков\n` +
         `   • Удобная парковка\n` +
         `   • Большие залы\n\n` +
         `3. **Купчино**\n` +
         `   • Метро: Купчино\n` +
         `   • Современное оборудование\n` +
         `   • Комфортные раздевалки\n\n` +
         `4. **Озерки**\n` +
         `   • Метро: Озерки\n` +
         `   • Светлые залы\n` +
         `   • Новые зеркала\n\n` +
         `🎯 **Во всех филиалах:**\n` +
         `• Единые цены\n` +
         `• Профессиональные тренеры\n` +
         `• Группы для начинающих\n` +
         `• Современное оборудование\n\n` +
         `🔗 **Все адреса и контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}`;
}

// Обработчик для категории НАЧАЛО
function handleStartCategory(query) {
  return `🎯 **Как начать танцевать в CosmoDance:**\n\n` +
         `**1. Выберите направление**\n` +
         `• Посмотрите все направления\n` +
         `• Выберите то, что вам нравится\n` +
         `• Не бойтесь пробовать новое\n\n` +
         `**2. Найдите ближайший филиал**\n` +
         `• У нас 4 филиала в СПб\n` +
         `• Выберите самый удобный\n` +
         `• Уточните расписание\n\n` +
         `**3. Запишитесь на пробное занятие**\n` +
         `• Стоимость: 400 ₽\n` +
         `• Длительность: 60 минут\n` +
         `• Бесплатно при покупке абонемента\n\n` +
         `**4. Подготовьтесь к первому занятию**\n` +
         `• Удобная одежда\n` +
         `• Чешки/кроссовки\n` +
         `• Бутылка воды\n` +
         `• Хорошее настроение!\n\n` +
         `**5. Приходите на занятие**\n` +
         `• Приходите за 10-15 минут\n` +
         `• Познакомьтесь с тренером\n` +
         `• Не стесняйтесь задавать вопросы\n\n` +
         `💪 **Все начинают с нуля — вы тоже сможете!**\n\n` +
         `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
         `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n` +
         `📍 **Контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}`;
}

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
    
    // ============ 1. ПРОВЕРКА АНГЛИЙСКОЙ РАСКЛАДКИ ============
    if (isEnglishLayout(userMessage)) {
      const fixedMessage = fixEnglishLayout(userMessage);
      const response = `🔤 **Вы пишете на английской раскладке**\n\n` +
                      `Пожалуйста, переключитесь на **русскую раскладку** (Alt+Shift или Ctrl+Shift).\n\n` +
                      `💡 **Ваш вопрос на русском должен выглядеть так:**\n` +
                      `"${fixedMessage}"\n\n` +
                      `🎯 **Напишите его еще раз на русском, и я с радостью отвечу!**\n\n` +
                      `📝 **Примеры вопросов на русском:**\n` +
                      `• "Сколько стоит пробное занятие?"\n` +
                      `• "Какие есть направления танцев?"\n` +
                      `• "Как добраться до филиала на Звёздной?"`;
      
      return res.json({
        reply: response,
        source: "english_layout_warning"
      });
    }
    
    const normalizedQuery = userMessage.toLowerCase();
    
    // ============ 2. БАЗОВЫЕ ПРИВЕТСТВИЯ ============
    const greetings = {
      'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?',
      'здравствуйте': '👋 Здравствуйте! Я ассистент студии CosmoDance. Готов ответить на ваши вопросы!',
      'добрый день': '👋 Добрый день! Рад вас видеть в студии CosmoDance!',
      'доброе утро': '👋 Доброе утро! Готов ответить на ваши вопросы.',
      'добрый вечер': '👋 Добрый вечер! Чем могу помочь?',
      'hi': '👋 Hello! I am CosmoDance chat bot. Please write in Russian!',
      'hello': '👋 Hello! I understand Russian better. Please write in Russian!'
    };
    
    for (const [greeting, response] of Object.entries(greetings)) {
      if (normalizedQuery.includes(greeting) && greeting.length > 2) {
        return res.json({ 
          reply: response,
          source: "greeting"
        });
      }
    }
    
    // ============ 3. ПОИСК ТАНЦЕВАЛЬНЫХ НАПРАВЛЕНИЙ ============
    const danceResult = findDirection(userMessage);
    if (danceResult.found) {
      if (danceResult.available) {
        const dir = danceResult.direction;
        const response = `💃 **${dir.name}**\n\n` +
                        `📝 **Описание:** ${dir.description}\n\n` +
                        `🎯 **Для начинающих:** ${dir.for_beginners}\n` +
                        `⏱️ **Длительность:** ${dir.duration}\n` +
                        `⭐ **Популярность:** ${dir.popularity}\n\n` +
                        `🏷️ **Особенности:** ${dir.tags.join(', ')}\n\n` +
                        `📅 **Расписание этого направления:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
                        `💰 **Цены едины для всех направлений!**`;
        
        return res.json({
          reply: response,
          source: "dance_direction"
        });
      } else {
        const dir = danceResult.direction;
        const availableDirs = getPopularDirections();
        
        const response = `ℹ️ **${dir.name}**\n\n` +
                        `📝 **Описание:** ${dir.description}\n\n` +
                        `❌ **Статус:** ${dir.status}\n` +
                        `📋 **Причина:** ${dir.reason}\n\n` +
                        `🎯 **Вместо этого можете попробовать в CosmoDance:**\n` +
                        `${availableDirs.map(dir => `• ${dir}`).join('\n')}\n\n` +
                        `💡 **Или спросите администратора о планах на будущее!**`;
        
        return res.json({
          reply: response,
          source: "dance_direction_not_available"
        });
      }
    }
    
    // ============ 4. ОБЩИЙ ЗАПРОС О НАПРАВЛЕНИЯХ ============
    if (normalizedQuery.includes('танец') || 
        normalizedQuery.includes('танц') ||
        normalizedQuery.includes('направлен') ||
        normalizedQuery.includes('стиль') ||
        normalizedQuery.includes('чем заняться')) {
      
      const availableDirs = getAvailableDirections();
      const popularDirs = getPopularDirections();
      
      const response = `💃 **Танцевальные направления в CosmoDance:**\n\n` +
                      `🎯 **Доступные сейчас:**\n` +
                      `${availableDirs.map(dir => `• ${dir}`).join('\n')}\n\n` +
                      `🔥 **Самые популярные:**\n` +
                      `${popularDirs.map(dir => `• ${dir}`).join('\n')}\n\n` +
                      `💎 **Все цены одинаковые для всех направлений!**\n\n` +
                      `🎯 **Хотите узнать о конкретном направлении?**\n` +
                      `Спросите, например:\n` +
                      `• "Расскажи про хип-хоп"\n` +
                      `• "Что такое contemporary?"\n` +
                      `• "Чем отличается jazz funk?"\n\n` +
                      `🔗 **Все направления:** ${KNOWLEDGE.info?.directions_link || 'https://cosmo.su/directions/'}`;
      
      return res.json({
        reply: response,
        source: "all_directions"
      });
    }
    
    // ============ 5. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ ЗАПРОСА ============
    const categoryResult = matcher.determineCategory(userMessage);
    
    if (categoryResult.category && categoryResult.score > 0) {
      console.log(`🎯 Категория: ${categoryResult.category} (оценка: ${categoryResult.score})`);
      
      let response = '';
      let source = '';
      
      switch (categoryResult.category) {
        case 'prices':
          response = handlePricesCategory(userMessage);
          source = 'prices_category';
          break;
          
        case 'schedule':
          response = handleScheduleCategory(userMessage);
          source = 'schedule_category';
          break;
          
        case 'branches':
          response = handleBranchesCategory(userMessage);
          source = 'branches_category';
          break;
          
        case 'start':
          response = handleStartCategory(userMessage);
          source = 'start_category';
          break;
          
        case 'equipment':
          response = `🎒 **Что нужно на первое занятие:**\n\n` +
                    `1. **Одежда:** удобная, не сковывающая движения\n` +
                    `2. **Обувь:** чешки, кроссовки или носки\n` +
                    `3. **Вода:** бутылка с водой\n` +
                    `4. **Полотенце:** по желанию\n` +
                    `5. **Хорошее настроение!**\n\n` +
                    `💎 **Все остальное предоставляет студия.**\n` +
                    `🔗 **Подробнее:** ${KNOWLEDGE.info?.website || 'https://cosmo.su/'}`;
          source = 'equipment_category';
          break;
          
        case 'trainers':
          response = `👨‍🏫 **Наши тренеры:**\n\n` +
                    `• Профессиональные хореографы\n` +
                    `• Опыт работы от 5 лет\n` +
                    `• Участие в чемпионатах\n` +
                    `• Индивидуальный подход к новичкам\n\n` +
                    `🔥 **Все тренеры специализируются на работе с начинающими!**\n\n` +
                    `🎯 **Они помогут вам:**\n` +
                    `• Начать с нуля\n` +
                    `• Поставить правильную технику\n` +
                    `• Преодолеть стеснение\n` +
                    `• Получать удовольствие от танца\n\n` +
                    `🔗 **Подробнее о тренерах:** ${KNOWLEDGE.info?.trainers_link || 'https://cosmo.su/trainers/'}`;
          source = 'trainers_category';
          break;
          
        case 'age':
          response = `👶 **Возрастные группы:**\n\n` +
                    `🎯 **Для взрослых:**\n` +
                    `• От 16 лет и старше\n` +
                    `• Нет верхнего ограничения по возрасту\n` +
                    `• Группы для всех уровней\n\n` +
                    `👧 **Для детей:**\n` +
                    `• От 5 лет\n` +
                    `• Специальные детские группы\n` +
                    `• Игровой формат занятий\n` +
                    `• Дневник танцора в подарок\n\n` +
                    `💎 **В CosmoDance танцуют в любом возрасте!**\n\n` +
                    `📞 **Уточните возрастные группы у администратора.**`;
          source = 'age_category';
          break;
          
        default:
          // Если категория определена, но нет специального обработчика
          const knowledgeMatch = searchInKnowledge(userMessage);
          if (knowledgeMatch) {
            response = `🎯 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}`;
            source = 'knowledge_base';
          }
          break;
      }
      
      if (response) {
        return res.json({
          reply: response,
          source: source
        });
      }
    }
    
    // ============ 6. ПОИСК В БАЗЕ ЗНАНИЙ ============
    const knowledgeMatch = searchInKnowledge(userMessage);
    if (knowledgeMatch) {
      console.log(`✅ Найдено в базе знаний: "${knowledgeMatch.title}"`);
      
      let response = '';
      
      if (knowledgeMatch.category === 'prices') {
        response = `💰 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}\n\n` +
                   `💎 **Актуальные цены всегда на сайте:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
      } else if (knowledgeMatch.category === 'branches') {
        response = `📍 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}\n\n` +
                   `🔗 **Контакты и точный адрес:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}`;
      } else {
        response = `🎯 **${knowledgeMatch.title}**\n\n${knowledgeMatch.text}`;
      }
      
      return res.json({
        reply: response,
        source: "knowledge_base"
      });
    }
    
    // ============ 7. ОБЩИЙ ОТВЕТ С ПОДСКАЗКАМИ ============
    const suggestions = matcher.generateSuggestions(userMessage);
    
    const generalResponse = `🎯 **CosmoDance**\n\n` +
      `Кажется, я не совсем понял ваш вопрос. Попробуйте спросить иначе:\n\n` +
      `${suggestions.join('\n')}\n\n` +
      `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
      `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n` +
      `📍 **Контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}\n` +
      `💃 **Направления:** ${KNOWLEDGE.info?.directions_link || 'https://cosmo.su/directions/'}`;
    
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
             `🌐 **Сайт:** ${KNOWLEDGE.info?.website || 'https://cosmo.su/'}\n\n` +
             `📞 **Свяжитесь с нами для записи и консультации.**`,
      error: true,
      source: "fallback"
    });
  }
});

// ============ ДОПОЛНИТЕЛЬНЫЕ МАРШРУТЫ ============

// Диагностика
app.get("/debug", (req, res) => {
  const testQuery = req.query.q || "пробное занятие";
  const categoryResult = matcher.determineCategory(testQuery);
  
  res.json({
    query: testQuery,
    normalized: testQuery.toLowerCase(),
    category: categoryResult.category,
    score: categoryResult.score,
    all_scores: categoryResult.allScores,
    knowledge_count: KNOWLEDGE.docs?.length || 0,
    variations_count: Object.keys(matcher.variations).reduce((sum, cat) => sum + matcher.variations[cat].length, 0),
    dance_directions_available: getAvailableDirections().length,
    dance_directions_popular: getPopularDirections().length
  });
});

// Просмотр базы знаний
app.get("/api/knowledge", (req, res) => {
  const { search, category } = req.query;
  
  let results = KNOWLEDGE.docs || [];
  
  if (search) {
    results = results.filter(doc => 
      doc.title?.toLowerCase().includes(search.toLowerCase()) ||
      doc.text?.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    );
  }
  
  if (category) {
    results = results.filter(doc => doc.category === category);
  }
  
  res.json({
    search,
    category,
    total: KNOWLEDGE.docs?.length || 0,
    count: results.length,
    results: results.map(doc => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      excerpt: doc.text?.substring(0, 150) + (doc.text?.length > 150 ? '...' : '')
    }))
  });
});

// Список направлений
app.get("/api/directions", (req, res) => {
  const available = getAvailableDirections();
  const popular = getPopularDirections();
  
  res.json({
    available,
    popular,
    available_count: available.length,
    popular_count: popular.length,
    note: "Все цены одинаковые для всех направлений"
  });
});

// Статистика
app.get("/health", (req, res) => {
  const categories = [...new Set(KNOWLEDGE.docs?.map(d => d.category).filter(Boolean))];
  const availableDirs = getAvailableDirections();
  
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "4.0",
    timestamp: new Date().toISOString(),
    knowledge_base: {
      docs: KNOWLEDGE.docs?.length || 0,
      categories: categories,
      categories_count: categories.length
    },
    dance_directions: {
      available: availableDirs.length,
      popular: getPopularDirections().length
    },
    intelligent_matcher: {
      categories: Object.keys(matcher.variations).length,
      total_variations: Object.keys(matcher.variations).reduce((sum, cat) => sum + matcher.variations[cat].length, 0)
    },
    features: [
      "Понимает более 800 вариантов запросов",
      "Определяет английскую раскладку",
      "Знает 50+ танцевальных направлений",
      "Отвечает на косвенные вопросы",
      "Ищет в базе знаний",
      "Дает подсказки по категориям"
    ],
    links: KNOWLEDGE.info
  });
});

// ============ ЗАПУСК СЕРВЕРА ============
const port = process.env.PORT || 10000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log("=".repeat(60));
  console.log("🚀 CosmoDance Chat Bot v4.0 ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log("=".repeat(60));
  console.log("✨ **УМНЫЕ ВОЗМОЖНОСТИ:**");
  console.log("• Понимает 800+ вариантов запросов");
  console.log("• Знает 50+ танцевальных направлений");
  console.log("• Определяет английскую раскладку");
  console.log("• Отвечает на косвенные вопросы");
  console.log("• Ищет в базе знаний");
  console.log("• Дает контекстные подсказки");
  console.log("=".repeat(60));
  console.log("🎯 **Примеры запросов:**");
  console.log("• 'Сколько стоит пробное занятие?'");
  console.log("• 'Какие есть направления танцев?'");
  console.log("• 'Как добраться до Звёздной?'");
  console.log("• 'Хочу начать танцевать с нуля'");
  console.log("• 'Что такое contemporary?'");
  console.log("=".repeat(60));
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
