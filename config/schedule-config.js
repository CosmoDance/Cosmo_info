// config/schedule-config.js - КОНФИГУРАЦИЯ ПАРСЕРА
export const SCHEDULE_CONFIG = {
  // Основные настройки
  BASE_URL: 'https://cosmo.su/raspisanie/',
  CACHE_TTL: 2 * 60 * 60 * 1000, // 2 часа в миллисекундах
  REQUEST_TIMEOUT: 15000,
  
  // Настройки парсера (выберите один способ)
  PARSER_TYPE: 'auto', // 'auto', 'table', 'div', 'text'
  
  // Селекторы для парсинга (подставьте реальные с анализа)
  SELECTORS: {
    // Способ 1: Для таблиц
    TABLE: {
      container: 'table.schedule-table, .raspisanie table, table',
      row: 'tr',
      cells: 'td, th',
      branchHeader: 'h2, h3, .branch-title' // Селектор для названия филиала
    },
    
    // Способ 2: Для div-блоков
    DIV: {
      container: '.schedule-container, .raspisanie-block, div[class*="schedule"]',
      item: '.schedule-item, .group-item, .lesson',
      time: '.time, .schedule-time',
      name: '.name, .group-name, .title',
      day: '.day, .weekday'
    },
    
    // Способ 3: Для текстового парсинга
    TEXT: {
      branchPatterns: [
        /филиал[:\s]*([^<\n]+)/i,
        /([А-Я][а-яё]+)\s*\(филиал\)/i,
        /^([А-Я][а-яё]+)\s*$/m
      ],
      timePattern: /\b(\d{1,2}[:.]\d{2})\s*[-—]\s*(\d{1,2}[:.]\d{2})\b/,
      dayPattern: /(пн|вт|ср|чт|пт|сб|вс)[\s.,:-]*/gi
    }
  },
  
  // Филиалы для поиска
  BRANCHES: [
    { name: 'Дыбенко', aliases: ['дыбенко', 'dybenko'] },
    { name: 'Купчино', aliases: ['купчино', 'kupchino'] },
    { name: 'Звёздная', aliases: ['звездная', 'звёздная', 'zvezdnaya'] },
    { name: 'Озерки', aliases: ['озерки', 'ozerki'] }
  ],
  
  // Направления танцев для фильтрации
  DANCE_STYLES: [
    'Hip-Hop', 'Хип-Хоп', 'Jazz Funk', 'Джаз Фанк', 'Break Dance', 'Брейк',
    'Contemporary', 'Контемп', 'Dance Mix', 'Дэнс Микс', 'High Heels', 'Хай Хилс',
    'Shuffle', 'Шаффл', 'Twerk', 'Тверк', 'Strip', 'Стрип', 'Latina', 'Латина',
    'Бачата', 'Bachata', 'Сальса', 'Salsa', 'Zumba', 'Зумба', 'Растяжка',
    'Акробатика', 'Боди балет', 'Восточный', 'Бальные', 'Хореография'
  ]
};

// Настройки для разных режимов
export const PARSER_MODES = {
  DEVELOPMENT: {
    debug: true,
    cacheEnabled: false,
    saveRawHtml: true
  },
  PRODUCTION: {
    debug: false,
    cacheEnabled: true,
    saveRawHtml: false
  }
};
