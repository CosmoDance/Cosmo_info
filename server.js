// server.js - CosmoDance Chat Bot v2.5 (Только база знаний)
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

// Middleware
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

// ============ ПОИСК В БАЗЕ ЗНАНИЙ ============
function searchInKnowledge(query) {
  if (!KNOWLEDGE.docs || !Array.isArray(KNOWLEDGE.docs)) {
    return null;
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Ищем точные совпадения в заголовках
  const exactMatch = KNOWLEDGE.docs.find(doc => 
    doc.title && doc.title.toLowerCase().includes(lowerQuery)
  );
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // Ищем в тексте документов
  const textMatch = KNOWLEDGE.docs.find(doc => 
    doc.text && doc.text.toLowerCase().includes(lowerQuery)
  );
  
  if (textMatch) {
    return textMatch;
  }
  
  // Разбиваем запрос на слова и ищем частичные совпадения
  const queryWords = lowerQuery.split(' ').filter(word => word.length > 3);
  
  for (const doc of KNOWLEDGE.docs) {
    const docText = (doc.title + ' ' + doc.text).toLowerCase();
    const matchCount = queryWords.filter(word => docText.includes(word)).length;
    
    if (matchCount >= queryWords.length / 2) {
      return doc;
    }
  }
  
  return null;
}

// ============ ЛОКАЛЬНЫЕ ОТВЕТЫ ============
const LOCAL_RESPONSES = {
  // Приветствия
  'привет': '👋 Привет! Я чат-бот студии танцев CosmoDance. Чем могу помочь?',
  'здравствуйте': '👋 Здравствуйте! Я ассистент студии CosmoDance.',
  'добрый день': '👋 Добрый день! Рад вас видеть в студии CosmoDance!',
  'доброе утро': '👋 Доброе утро! Готов ответить на ваши вопросы.',
  'добрый вечер': '👋 Добрый вечер! Чем могу помочь?',
  'start': '🎯 **Добро пожаловать в CosmoDance!**\n\nЯ помогу вам:\n• Узнать расписание\n• Узнать цены\n• Найти филиал\n• Записаться на занятие\n\nЧто вас интересует?',
  
  // Быстрые ссылки
  'сайт': `🌐 **Наш сайт:** ${KNOWLEDGE.info?.website || 'https://cosmo.su/'}\nЗдесь вся актуальная информация!`,
  'расписание': `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n\n🎯 **Совет:** Всегда проверяйте актуальное расписание на сайте`,
  'цены': `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n\n💎 **Примечание:** Точные цены и акции уточняйте на сайте`,
  'контакты': `📞 **Контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}\n\n📍 Адреса всех филиалов и телефоны`,
  
  // Филиалы (общая информация)
  'звездн': '📍 **Филиал на Звёздной:**\n\n🚇 **Метро:** Звёздная\n• 5-7 минут пешком от метро\n• Современные залы\n• Все группы для начинающих\n\n🔗 **Подробнее:** https://cosmo.su/contacts/#zvezdnaya',
  
  'дыбенк': '📍 **Филиал на Дыбенко:**\n\n🚇 **Метро:** Проспект Большевиков\n• Удобное расположение\n• Большие залы\n• Парковка рядом\n\n🔗 **Подробнее:** https://cosmo.su/contacts/#dybenko',
  
  'купчин': '📍 **Филиал в Купчино:**\n\n🚇 **Метро:** Купчино\n• Современное оборудование\n• Комфортные раздевалки\n• Зона отдыха\n\n🔗 **Подробнее:** https://cosmo.su/contacts/#kupchino',
  
  'озерк': '📍 **Филиал в Озерках:**\n\n🚇 **Метро:** Озерки\n• Светлые залы\n• Новые зеркала\n• Современная вентиляция\n\n🔗 **Подробнее:** https://cosmo.su/contacts/#ozerki',
  
  'филиалы': '📍 **Наши филиалы в Санкт-Петербурге:**\n\n1. **Звёздная** (м. Звёздная)\n2. **Дыбенко** (м. Пр. Большевиков)\n3. **Купчино** (м. Купчино)\n4. **Озерки** (м. Озерки)\n\n🔗 **Все адреса и контакты:** https://cosmo.su/contacts/',
  
  // Общая информация
  'сколько стоит': `💰 **Информация о ценах:**\n\nДля получения актуальных цен:\n1. Посетите страницу: ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n2. Свяжитесь с администратором\n3. Придите на пробное занятие\n\n💎 **На сайте всегда самые свежие цены и акции!**`,
  
  'абонемент': '🎫 **Об абонементах:**\n\nВ CosmoDance есть несколько видов абонементов:\n• На разное количество занятий\n• С разными сроками действия\n• Со скидками для студентов\n\n🔗 **Актуальные варианты:** https://cosmo.su/prices/',
  
  'начать': '🎯 **Как начать танцевать в CosmoDance:**\n\n1. **Выберите направление** которое вам нравится\n2. **Найдите ближайший филиал**\n3. **Посмотрите расписание** для начинающих\n4. **Запишитесь на пробное занятие**\n5. **Приходите в удобной одежде**\n\n📅 **Расписание:** https://cosmo.su/raspisanie/\n💰 **Цены:** https://cosmo.su/prices/',
  
  'новичок': '🎯 **Для новичков:**\n\n✅ **Не нужно подготовки** - все начинают с нуля!\n✅ **Индивидуальный подход** к каждому\n✅ **Дружелюбная атмосфера**\n✅ **Опытные тренеры**\n\n🔥 **Популярные направления для начинающих:**\n• Hip-Hop\n• Jazz Funk\n• Contemporary\n• High Heels\n• Latina\n\n📅 **Выберите и приходите!**',
  
  'записаться': '📝 **Как записаться:**\n\n**Способы:**\n1. **На сайте** через форму записи\n2. **По телефону** филиала\n3. **В соцсетях** студии\n4. **Лично** в студии\n\n🎯 **Перед записью:**\n• Посмотрите расписание\n• Выберите удобный филиал\n• Определитесь с направлением\n\n🔗 **Форма записи на сайте:** https://cosmo.su/',
  
  'направлен': '💃 **Направления танцев:**\n\n🎯 **Для начинающих доступны:**\n• Hip-Hop (хип-хоп)\n• Jazz Funk (джаз-фанк)\n• Contemporary (контемпорари)\n• High Heels (высокие каблуки)\n• Latina (латина)\n• Twerk (тверк)\n• Strip Dance (стрип-пластика)\n• Break Dance (брейк-данс)\n\n🔗 **Все направления:** https://cosmo.su/directions/',
  
  'что нужно': '🎒 **Для первого занятия:**\n\n1. **Одежда:** удобная, не сковывающая\n2. **Обувь:** чешки, кроссовки или носки\n3. **Вода:** бутылка с водой\n4. **Полотенце:** по желанию\n5. **Хорошее настроение!**\n\n💎 **Все остальное предоставляет студия.**',
  
  'тренер': '👨‍🏫 **Наши тренеры:**\n\n• Профессиональные хореографы\n• Опыт работы от 5 лет\n• Участие в чемпионатах\n• Индивидуальный подход к новичкам\n\n🔥 **Все тренеры специализируются на работе с начинающими!**\n🔗 **Подробнее:** https://cosmo.su/trainers/'
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
    
    const lowerMessage = userMessage.toLowerCase();
    
    // 1. Проверяем локальные ответы
    for (const [key, response] of Object.entries(LOCAL_RESPONSES)) {
      if (lowerMessage.includes(key) && key.length > 3) {
        console.log(`✅ Используем локальный ответ для: ${key}`);
        return res.json({ 
          reply: response,
          source: "local_response"
        });
      }
    }
    
    // 2. Ищем в базе знаний
    const knowledgeMatch = searchInKnowledge(userMessage);
    if (knowledgeMatch) {
      console.log(`✅ Найдено в базе знаний: ${knowledgeMatch.title}`);
      
      let response = `🎯 **${knowledgeMatch.title}**\n\n`;
      response += knowledgeMatch.text + '\n\n';
      
      // Добавляем ссылку если есть
      if (knowledgeMatch.link) {
        response += `🔗 Подробнее: ${knowledgeMatch.link}`;
      } else if (knowledgeMatch.category === 'schedule') {
        response += `📅 Актуальное расписание: ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}`;
      } else if (knowledgeMatch.category === 'prices') {
        response += `💰 Актуальные цены: ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}`;
      }
      
      return res.json({
        reply: response,
        source: "knowledge_base"
      });
    }
    
    // 3. Общий ответ с ссылками
    const generalResponse = `🎯 **Студия танцев CosmoDance**\n\n` +
      `Я нашел в базе знаний информацию по вашему запросу, но для точных данных:\n\n` +
      `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
      `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n` +
      `📍 **Контакты:** ${KNOWLEDGE.info?.contacts_link || 'https://cosmo.su/contacts/'}\n\n` +
      `📞 **Или задайте вопрос более конкретно:**\n` +
      `• "Какие группы для начинающих на Звёздной?"\n` +
      `• "Сколько стоит абонемент на 8 занятий?"\n` +
      `• "Как записаться на пробное занятие?"`;
    
    return res.json({
      reply: generalResponse,
      source: "general_info"
    });

  } catch (error) {
    console.error("❌ Ошибка обработки запроса:", error.message);
    
    res.json({ 
      reply: `🎯 **Студия танцев CosmoDance**\n\n` +
             `📍 **Филиалы:** Звёздная, Дыбенко, Купчино, Озерки\n` +
             `📅 **Расписание:** ${KNOWLEDGE.info?.schedule_link || 'https://cosmo.su/raspisanie/'}\n` +
             `💰 **Цены:** ${KNOWLEDGE.info?.prices_link || 'https://cosmo.su/prices/'}\n` +
             `🌐 **Сайт:** ${KNOWLEDGE.info?.website || 'https://cosmo.su/'}\n\n` +
             `📞 **Свяжитесь с нами для записи и консультации.**`,
      error: true,
      source: "error_fallback"
    });
  }
});

// Просмотр базы знаний (для отладки)
app.get("/api/knowledge", (req, res) => {
  const { search } = req.query;
  
  if (search) {
    const results = KNOWLEDGE.docs?.filter(doc => 
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.text.toLowerCase().includes(search.toLowerCase())
    ) || [];
    
    res.json({
      search,
      count: results.length,
      results: results.map(doc => ({
        title: doc.title,
        category: doc.category,
        excerpt: doc.text.substring(0, 150) + '...'
      }))
    });
  } else {
    res.json({
      total_docs: KNOWLEDGE.docs?.length || 0,
      categories: [...new Set(KNOWLEDGE.docs?.map(d => d.category).filter(Boolean))],
      info: KNOWLEDGE.info
    });
  }
});

// Статистика
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    version: "2.5",
    timestamp: new Date().toISOString(),
    knowledge_base: {
      total_docs: KNOWLEDGE.docs?.length || 0,
      categories: [...new Set(KNOWLEDGE.docs?.map(d => d.category).filter(Boolean))],
      last_updated: KNOWLEDGE.last_updated
    },
    features: {
      local_responses: Object.keys(LOCAL_RESPONSES).length,
      knowledge_search: true,
      no_parsers: true
    },
    links: KNOWLEDGE.info
  });
});

// ============ ЗАПУСК СЕРВЕРА ============
const port = process.env.PORT || 10000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log("=".repeat(60));
  console.log("🚀 CosmoDance Chat Bot v2.5 ЗАПУЩЕН!");
  console.log(`📍 Порт: ${port}`);
  console.log(`🌐 Хост: ${host}`);
  console.log(`🔗 URL: http://${host}:${port}`);
  console.log(`📚 База знаний: ${KNOWLEDGE.docs?.length || 0} документов`);
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
