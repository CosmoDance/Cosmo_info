// schedule-parser.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs'; // ← ДОБАВЬТЕ ЭТОТ ИМПОРТ!

class CosmoScheduleParser {
  constructor(mode = 'production') {
    this.config = {
      BASE_URL: 'https://cosmo.su/raspisanie/',
      CACHE_TTL: 2 * 60 * 60 * 1000, // 2 часа
      REQUEST_TIMEOUT: 15000,
      PARSER_TYPE: 'auto',
      BRANCHES: [
        { name: 'Дыбенко', aliases: ['дыбенко'] },
        { name: 'Купчино', aliases: ['купчино'] },
        { name: 'Звёздная', aliases: ['звездная', 'звёздная'] },
        { name: 'Озерки', aliases: ['озерки'] }
      ]
    };
    
    this.mode = mode === 'development' 
      ? { debug: true, cacheEnabled: false, saveRawHtml: false }
      : { debug: false, cacheEnabled: true, saveRawHtml: false };
    
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
    let scheduleData = await this.tryAllParsers($, data);
    
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
    // Сначала пробуем текстовый парсинг (самый простой)
    try {
      const result = await this.parseText(rawData);
      if (Object.keys(result).length > 0) {
        console.log('✅ Использован текстовый парсер');
        return result;
      }
    } catch (error) {
      // Игнорируем ошибку, пробуем дальше
    }
    
    // Затем пробуем табличный
    try {
      const result = await this.parseTables($);
      if (Object.keys(result).length > 0) {
        console.log('✅ Использован табличный парсер');
        return result;
      }
    } catch (error) {
      // Игнорируем
    }
    
    // Если ничего не нашли, возвращаем базовую структуру
    console.log('⚠️ Не удалось распарсить расписание');
    return this.getFallbackSchedule();
  }

  /**
   * Текстовый парсинг (самый надежный)
   */
  async parseText(rawData) {
    const schedule = {};
    
    // Разбиваем текст на строки
    const lines = rawData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentBranch = null;
    
    for (const line of lines) {
      // Проверяем, начинается ли строка с названия филиала
      const branchMatch = this.detectBranch(line, true);
      if (branchMatch) {
        currentBranch = branchMatch;
        schedule[currentBranch] = [];
        continue;
      }
      
      // Если нашли филиал, ищем время занятий
      if (currentBranch && this.isScheduleLine(line)) {
        schedule[currentBranch].push(line);
      }
    }
    
    return schedule;
  }

  /**
   * Парсинг таблиц
   */
  async parseTables($) {
    const schedule = {};
    
    $('table').each((i, table) => {
      const tableText = $(table).text().trim();
      const branchName = this.detectBranch(tableText) || `Филиал_${i + 1}`;
      
      schedule[branchName] = [];
      
      $(table).find('tr').each((j, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const time = $(cells[0]).text().trim();
          const group = $(cells[1]).text().trim();
          
          if (time && group) {
            schedule[branchName].push(`${time} - ${group}`);
          }
        }
      });
    });
    
    return schedule;
  }

  /**
   * Fallback расписание
   */
  getFallbackSchedule() {
    return {
      'Дыбенко': [
        'Пн, Ср: 18:00-19:00 - Hip-Hop 12+',
        'Вт, Чт: 19:00-20:00 - Jazz Funk 16+'
      ],
      'Купчино': [
        'Пн, Ср: 17:30-18:30 - Contemporary 12+',
        'Вт, Чт: 18:00-19:00 - Shuffle 7+'
      ],
      'Звёздная': [
        'Пн, Чт: 19:00-20:00 - High Heels 18+',
        'Вт, Пт: 18:00-19:00 - Twerk 16+'
      ],
      'Озерки': [
        'Вт, Чт: 18:30-19:30 - Latina Solo 18+',
        'Пн, Ср: 17:00-18:00 - Dance Mix 8-12'
      ]
    };
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

  isScheduleLine(line) {
    return (
      (line.includes(':') || line.includes('-')) &&
      line.length > 10 &&
      line.length < 150 &&
      !line.includes('<!') &&
      !line.includes('function')
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

  // ИСПРАВЛЕННЫЙ МЕТОД - ДОБАВЛЕНО async!
  async saveRawData(data, filename) {
    fs.writeFileSync(filename, data);
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
