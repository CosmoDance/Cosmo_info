// cosmo-parser.js - Надежный парсер для Render
import axios from 'axios';
import * as cheerio from 'cheerio';

class CosmoParser {
  constructor() {
    this.scheduleUrl = 'https://cosmo.su/raspisanie/';
    this.pricesUrl = 'https://cosmo.su/prices/';
    
    // Кэш в памяти
    this.cache = {
      schedule: null,
      prices: null,
      timestamp: 0,
      ttl: 15 * 60 * 1000 // 15 минут
    };
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0
    };
  }

  /**
   * Пробуем загрузить данные с сайта
   */
  async tryFetchData(url) {
    this.stats.totalRequests++;
    
    try {
      console.log(`🌐 Пробуем загрузить: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      });
      
      console.log(`✅ Успешно: ${response.status}, размер: ${response.data.length} байт`);
      this.stats.successfulRequests++;
      
      return response.data;
      
    } catch (error) {
      this.stats.failedRequests++;
      console.error(`❌ Ошибка загрузки ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Получить расписание (с кэшированием)
   */
  async getSchedule() {
    // Проверяем кэш
    if (this.cache.schedule && (Date.now() - this.cache.timestamp < this.cache.ttl)) {
      this.stats.cacheHits++;
      console.log('📅 Используем кэшированное расписание');
      return this.cache.schedule;
    }

    const html = await this.tryFetchData(this.scheduleUrl);
    
    if (html) {
      try {
        const schedule = this.parseSchedule(html);
        if (schedule && Object.keys(schedule).filter(k => !k.startsWith('_')).length > 0) {
          // Сохраняем в кэш
          this.cache.schedule = schedule;
          this.cache.timestamp = Date.now();
          return schedule;
        }
      } catch (parseError) {
        console.error('❌ Ошибка парсинга HTML:', parseError.message);
      }
    }
    
    // Если не удалось, возвращаем fallback
    console.log('⚠️ Используем fallback расписание');
    return this.getFallbackSchedule();
  }

  /**
   * Парсим расписание из HTML
   */
  parseSchedule(html) {
    const $ = cheerio.load(html);
    const schedule = {};
    
    // Ищем текст на странице
    const pageText = $('body').text();
    const lines = pageText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 10 && line.length < 200);
    
    // Филиалы для поиска
    const branches = [
      { name: 'Звёздная', patterns: ['звездн', 'звёздн'] },
      { name: 'Дыбенко', patterns: ['дыбенк'] },
      { name: 'Купчино', patterns: ['купчин'] },
      { name: 'Озерки', patterns: ['озерк'] }
    ];
    
    // Собираем строки для каждого филиала
    branches.forEach(branch => {
      const branchLines = lines.filter(line => {
        const lowerLine = line.toLowerCase();
        return branch.patterns.some(pattern => lowerLine.includes(pattern));
      }).slice(0, 15); // Ограничиваем количество
      
      if (branchLines.length > 0) {
        schedule[branch.name] = branchLines;
      }
    });
    
    // Если нашли данные, добавляем метаданные
    if (Object.keys(schedule).length > 0) {
      schedule._meta = {
        source: this.scheduleUrl,
        fetched_at: new Date().toISOString(),
        parser: 'cosmo-parser-2.0',
        branches_found: Object.keys(schedule).filter(k => !k.startsWith('_'))
      };
      
      console.log(`✅ Спарсено расписание для филиалов: ${schedule._meta.branches_found.join(', ')}`);
    }
    
    return schedule;
  }

  /**
   * Получить цены (с кэшированием)
   */
  async getPrices() {
    // Проверяем кэш
    if (this.cache.prices && (Date.now() - this.cache.timestamp < this.cache.ttl)) {
      return this.cache.prices;
    }

    const html = await this.tryFetchData(this.pricesUrl);
    
    if (html) {
      try {
        const prices = this.parsePrices(html);
        if (prices && Object.keys(prices).length > 0) {
          // Сохраняем в кэш
          this.cache.prices = prices;
          return prices;
        }
      } catch (parseError) {
        console.error('❌ Ошибка парсинга цен:', parseError.message);
      }
    }
    
    // Если не удалось, возвращаем fallback
    console.log('⚠️ Используем fallback цены');
    return this.getFallbackPrices();
  }

  /**
   * Парсим цены из HTML
   */
  parsePrices(html) {
    const $ = cheerio.load(html);
    const prices = {};
    
    // Ищем элементы с ценами
    $('h1, h2, h3, h4, h5, h6, p, div, span, li').each((i, element) => {
      const text = $(element).text().trim();
      const lowerText = text.toLowerCase();
      
      if (text.length > 10 && text.length < 300) {
        if (lowerText.includes('цена') || lowerText.includes('стоимость') || 
            lowerText.includes('абонемент') || lowerText.includes('руб') ||
            /\d+\s*₽/.test(text) || /\d+\s*руб/.test(text)) {
          
          const key = text.substring(0, 80).trim();
          if (key && !prices[key]) {
            prices[key] = text;
          }
        }
      }
    });
    
    // Добавляем обязательные поля
    prices['🔗 Актуальные цены на сайте'] = this.pricesUrl;
    prices['📞 Консультация по ценам'] = 'Для точного расчета свяжитесь с администратором';
    
    if (Object.keys(prices).length > 2) {
      console.log(`✅ Найдено ${Object.keys(prices).length} ценовых категорий`);
    }
    
    return prices;
  }

  /**
   * Получить расписание для клиентов (очищенное)
   */
  async getClientSchedule(branch = null) {
    try {
      const schedule = await this.getSchedule();
      const result = {};
      
      Object.entries(schedule).forEach(([branchName, items]) => {
        if (branchName.startsWith('_')) {
          result[branchName] = items;
          return;
        }
        
        // Фильтр по филиалу
        if (branch && !branchName.toLowerCase().includes(branch.toLowerCase())) {
          return;
        }
        
        if (Array.isArray(items)) {
          // Фильтруем группы для начинающих
          const beginnerGroups = items
            .filter(item => this.isForBeginners(item))
            .map(item => this.cleanGroupName(item))
            .slice(0, 8);
          
          if (beginnerGroups.length > 0) {
            result[branchName] = beginnerGroups;
          }
        }
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка подготовки клиентского расписания:', error.message);
      return this.getFallbackClientSchedule(branch);
    }
  }

  /**
   * Проверка, подходит ли группа для новичков
   */
  isForBeginners(text) {
    const lower = text.toLowerCase();
    const advancedKeywords = ['продолжающ', 'pro', 'команд', 'состав', 'отбор', 'advanced', 'выступлен'];
    return !advancedKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Очистка названия группы
   */
  cleanGroupName(text) {
    return `🎯 ${text
      .replace(/\s*\d+\+/gi, '')
      .replace(/\s*\(\d+.*?\)/g, '')
      .replace(/\s*\(.*продолж.*\)/gi, '')
      .replace(/\s*\(.*про.*\)/gi, '')
      .replace(/\d{1,2}[:.]\d{2}\s*[-—]\s*\d{1,2}[:.]\d{2}/g, '')
      .trim()}`;
  }

  /**
   * Fallback расписание (используется при ошибках)
   */
  getFallbackSchedule() {
    return {
      'Звёздная': [
        'High Heels (новички) Пн, Чт 19:00',
        'Twerk (начальный) Вт, Пт 18:00',
        'Hip-Hop (с нуля) Пн, Ср 18:00',
        'Акробатика (база) Ср, Сб 17:00',
        'Zumba (для всех) Вс 12:00'
      ],
      'Дыбенko': [
        'Hip-Hop (новички) Пн, Ср 18:00',
        'Jazz Funk (начальный) Вт, Чт 19:00',
        'Break Dance (база) Вт, Сб 17:00',
        'Contemporary (с нуля) Пт, Вс 15:00',
        'Latina (новички) Ср, Сб 19:00'
      ],
      'Купчино': [
        'Contemporary (начальный) Пн, Ср 17:30',
        'Shuffle (с нуля) Вт, Чт 18:00',
        'Strip Dance (база) Пт 19:00',
        'Бальные танцы (новички) Пн, Чт 19:30'
      ],
      'Озерки': [
        'Latina Solo (новички) Вт, Чт 18:30',
        'Dance Mix (начальный) Пн, Ср 17:00',
        'K-Pop (с нуля) Сб 13:00',
        'Восточные танцы (база) Ср, Сб 20:00'
      ],
      '_meta': {
        source: 'fallback',
        fetched_at: new Date().toISOString(),
        note: 'Это общая информация. Актуальное расписание на сайте.',
        link: this.scheduleUrl
      }
    };
  }

  /**
   * Fallback цены
   */
  getFallbackPrices() {
    return {
      '💰 Абонементы': '• 4 занятия: 3500-4500₽\n• 8 занятий: 6000-8000₽\n• 12 занятий: 8500-10000₽',
      '🎫 Разовые занятия': '• Групповое: 1000-1500₽\n• Индивидуальное: от 1500₽',
      '🎁 Скидки и акции': '• Студентам: -10%\n• Семейным парам: -15%\n• При покупке 2+ абонементов: -10%',
      '💎 Пробное занятие': '1000₽ (засчитывается в первый абонемент)',
      '⏰ Срок действия абонемента': '30 дней с даты первого занятия',
      '❄️ Заморозка абонемента': 'До 14 дней по запросу',
      '🔗 Актуальные цены на сайте': this.pricesUrl,
      '📞 Консультация администратора': 'Для точного расчета свяжитесь с нами'
    };
  }

  /**
   * Fallback расписание для клиентов
   */
  getFallbackClientSchedule(branch = null) {
    const schedule = this.getFallbackSchedule();
    
    if (branch) {
      const foundBranch = Object.keys(schedule).find(b => 
        b.toLowerCase().includes(branch.toLowerCase())
      );
      
      if (foundBranch && foundBranch !== '_meta') {
        const result = {};
        result[foundBranch] = schedule[foundBranch].map(item => 
          this.cleanGroupName(item)
        );
        result._meta = schedule._meta;
        return result;
      }
    }
    
    // Очищаем все названия для клиентской версии
    const result = {};
    Object.entries(schedule).forEach(([key, value]) => {
      if (key.startsWith('_')) {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => this.cleanGroupName(item));
      }
    });
    
    return result;
  }

  /**
   * Статистика парсера
   */
  getStats() {
    return {
      ...this.stats,
      cache: {
        schedule: !!this.cache.schedule,
        prices: !!this.cache.prices,
        age: this.cache.timestamp ? Date.now() - this.cache.timestamp : 0,
        ttl: this.cache.ttl
      },
      urls: {
        schedule: this.scheduleUrl,
        prices: this.pricesUrl
      }
    };
  }

  /**
   * Очистить кэш
   */
  clearCache() {
    this.cache.schedule = null;
    this.cache.prices = null;
    this.cache.timestamp = 0;
    console.log('🧹 Кэш парсера очищен');
  }
}

export default CosmoParser;
