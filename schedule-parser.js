// schedule-parser.js - УНИВЕРСАЛЬНЫЙ ПАРСЕР РАСПИСАНИЯ
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SCHEDULE_CONFIG, PARSER_MODES } from './config/schedule-config.js';

class CosmoScheduleParser {
  constructor(mode = 'production') {
    this.config = SCHEDULE_CONFIG;
    this.mode = PARSER_MODES[mode.toUpperCase()] || PARSER_MODES.PRODUCTION;
    
    // Кэш в памяти
    this.cache = {
      data: null,
      timestamp: 0,
      ttl: this.config.CACHE_TTL
    };
    
    // Статистика
    this.stats = {
      requests: 0,
      successes: 0,
      failures: 0,
      lastUpdate: null
    };
  }

  /**
   * Основной метод получения расписания
   */
  async getSchedule(branch = null) {
    this.stats.requests++;
    
    // Проверка кэша
    if (this.shouldUseCache()) {
      console.log('📅 Используем кэшированное расписание');
      return this.filterByBranch(this.cache.data, branch);
    }

    try {
      console.log('🔄 Получаем актуальное расписание с сайта...');
      
      // Загружаем и парсим
      const scheduleData = await this.fetchAndParse();
      
      // Обновляем кэш
      this.cache.data = scheduleData;
      this.cache.timestamp = Date.now();
      this.stats.successes++;
      this.stats.lastUpdate = new Date().toISOString();
      
      // Логируем успех
      if (this.mode.debug) {
        console.log('✅ Расписание успешно обновлено');
        console.log(`📊 Групп найдено: ${Object.values(scheduleData).flat().length}`);
      }
      
      return this.filterByBranch(scheduleData, branch);
      
    } catch (error) {
      this.stats.failures++;
      console.error('❌ Ошибка при получении расписания:', error.message);
      
      // Возвращаем кэш или пустые данные
      return this.cache.data ? this.filterByBranch(this.cache.data, branch) : {};
    }
  }

  /**
   * Автоматический выбор и выполнение парсинга
   */
  async fetchAndParse() {
    const { data, url } = await this.fetchWebsite();
    
    if (this.mode.saveRawHtml) {
      this.saveRawData(data, 'last-fetched.html');
    }
    
    const $ = cheerio.load(data);
    
    // Автоматическое определение способа парсинга
    let scheduleData;
    
    if (this.config.PARSER_TYPE === 'auto') {
      // Пробуем разные способы
      scheduleData = await this.tryAllParsers($, data);
    } else {
      // Используем указанный способ
      scheduleData = await this.parseWithMethod($, data, this.config.PARSER_TYPE);
    }
    
    // Добавляем метаданные
    scheduleData._meta = {
      source: url,
      fetched_at: new Date().toISOString(),
      parser_version: '2.0',
      next_update: new Date(Date.now() + this.config.CACHE_TTL).toISOString()
    };
    
    return scheduleData;
  }

  /**
   * Попробовать все способы парсинга
   */
  async tryAllParsers($, rawData) {
    const methods = ['table', 'div', 'text'];
    
    for (const method of methods) {
      try {
        const result = await this.parseWithMethod($, rawData, method);
        if (Object.keys(result).length > 0) {
          console.log(`✅ Успешно использован метод: ${method}`);
          return result;
        }
      } catch (error) {
        if (this.mode.debug) {
          console.log(`⚠️ Метод ${method} не сработал:`, error.message);
        }
      }
    }
    
    throw new Error('Не удалось распарсить расписание ни одним методом');
  }

  /**
   * Парсинг таблиц
   */
  async parseTables($) {
    const schedule = {};
    const { TABLE } = this.config.SELECTORS;
    
    $(TABLE.container).each((i, table) => {
      const tableText = $(table).text().trim();
      
      // Определяем филиал по заголовку
      let branchName = this.detectBranch(tableText);
      
      if (!branchName) {
        // Ищем заголовок перед таблицей
        const prevElement = $(table).prevAll('h2, h3, strong').first();
        if (prevElement.length) {
          branchName = this.detectBranch(prevElement.text());
        }
      }
      
      if (!branchName) {
        branchName = `Филиал_${i + 1}`;
      }
      
      schedule[branchName] = [];
      
      // Парсим строки таблицы
      $(table).find(TABLE.row).each((j, row) => {
        const cells = $(row).find(TABLE.cells);
        if (cells.length >= 2) {
          const time = $(cells[0]).text().trim();
          const group = $(cells[1]).text().trim();
          
          if (time && group && this.isValidScheduleEntry(time, group)) {
            schedule[branchName].push(`${time} - ${group}`);
          }
        }
      });
    });
    
    return schedule;
  }

  /**
   * Парсинг div-блоков
   */
  async parseDivs($) {
    const schedule = {};
    const { DIV } = this.config.SELECTORS;
    
    $(DIV.container).each((i, container) => {
      const containerText = $(container).text().trim();
      const branchName = this.detectBranch(containerText) || `Филиал_${i + 1}`;
      
      if (!schedule[branchName]) {
        schedule[branchName] = [];
      }
      
      $(container).find(DIV.item).each((j, item) => {
        const time = $(item).find(DIV.time).text().trim();
        const name = $(item).find(DIV.name).text().trim();
        const day = $(item).find(DIV.day).text().trim();
        
        if (time && name) {
          const entry = `${day ? day + ' ' : ''}${time} - ${name}`;
          schedule[branchName].push(entry);
        }
      });
    });
    
    return schedule;
  }

  /**
   * Текстовый парсинг
   */
  async parseText(rawData) {
    const schedule = {};
    const { TEXT } = this.config.SELECTORS;
    
    // Разбиваем текст на секции по филиалам
    const lines = rawData.split('\n');
    let currentBranch = null;
    
    for (const line of lines) {
      // Проверяем, начинается ли строка с названия филиала
      const branchMatch = this.detectBranch(line, true);
      if (branchMatch) {
        currentBranch = branchMatch;
        schedule[currentBranch] = [];
        continue;
      }
      
      // Если нашли филиал, ищем расписание
      if (currentBranch && this.isScheduleLine(line)) {
        schedule[currentBranch].push(line.trim());
      }
    }
    
    return schedule;
  }

  /**
   * Вспомогательные методы
   */
  detectBranch(text, exact = false) {
    for (const branch of this.config.BRANCHES) {
      if (exact) {
        if (branch.aliases.some(alias => 
          text.toLowerCase().includes(alias.toLowerCase())
        )) {
          return branch.name;
        }
      } else {
        if (text.includes(branch.name)) {
          return branch.name;
        }
      }
    }
    return null;
  }

  isValidScheduleEntry(time, group) {
    // Проверяем, что это похоже на расписание
    const hasTime = /\d{1,2}[:.]\d{2}/.test(time);
    const hasDanceStyle = this.config.DANCE_STYLES.some(style => 
      group.includes(style)
    );
    
    return hasTime && (hasDanceStyle || group.length > 3);
  }

  isScheduleLine(line) {
    return (
      line.includes(':') && // Есть время
      line.length > 10 && // Достаточно длинная
      line.length < 150 && // Не слишком длинная
      !line.includes('<!') && // Не HTML тег
      !line.includes('function') // Не JavaScript
    );
  }

  shouldUseCache() {
    if (!this.cache.data) return false;
    if (!this.mode.cacheEnabled) return false;
    
    const age = Date.now() - this.cache.timestamp;
    return age < this.cache.ttl;
  }

  filterByBranch(schedule, branch) {
    if (!branch || !schedule) return schedule;
    
    const branchName = this.detectBranch(branch, true) || branch;
    return {
      [branchName]: schedule[branchName] || [],
      _meta: schedule._meta
    };
  }

  async fetchWebsite() {
    const response = await axios.get(this.config.BASE_URL, {
      timeout: this.config.REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'CosmoDance-Schedule-Parser/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      }
    });
    
    return {
      data: response.data,
      url: response.config.url
    };
  }

  saveRawData(data, filename) {
    const fs = await import('fs');
    fs.writeFileSync(filename, data);
  }

  async parseWithMethod($, rawData, method) {
    switch (method) {
      case 'table':
        return await this.parseTables($);
      case 'div':
        return await this.parseDivs($);
      case 'text':
        return await this.parseText(rawData);
      default:
        throw new Error(`Неизвестный метод парсинга: ${method}`);
    }
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      ...this.stats,
      cacheAge: this.cache.timestamp ? Date.now() - this.cache.timestamp : null,
      cacheValid: this.shouldUseCache(),
      nextUpdate: this.cache.timestamp ? 
        new Date(this.cache.timestamp + this.cache.ttl).toISOString() : null
    };
  }

  /**
   * Очистить кэш
   */
  clearCache() {
    this.cache.data = null;
    this.cache.timestamp = 0;
    console.log('🧹 Кэш расписания очищен');
  }
}

export default CosmoScheduleParser;
