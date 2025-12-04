// cosmo-parser.js - Умный парсер для cosmo.su
import axios from 'axios';
import * as cheerio from 'cheerio';

class CosmoParser {
  constructor() {
    this.scheduleUrl = 'https://cosmo.su/raspisanie/';
    this.pricesUrl = 'https://cosmo.su/prices/';
    this.cache = {
      schedule: null,
      prices: null,
      timestamp: 0,
      ttl: 2 * 60 * 60 * 1000 // 2 часа
    };
    this.stats = {
      scheduleRequests: 0,
      priceRequests: 0,
      errors: 0
    };
  }

  /**
   * Определить, доступна ли группа для новичков
   */
  isGroupForBeginners(groupName) {
    const lowerName = groupName.toLowerCase();
    
    // Группы НЕ для новичков (нужна подготовка)
    const advancedKeywords = [
      'продолжающие', 'продолжающих', 'продвинутый', 'про', 'pro', 
      'команда', 'team', 'состав', 'отбор', 'кастинг', 'конкурс',
      'advanced', 'intermediate', 'competition', 'show', 'выступление'
    ];
    
    // Сначала проверяем, точно ли НЕ для новичков
    for (const keyword of advancedKeywords) {
      if (lowerName.includes(keyword)) {
        return false; // Не для новичков
      }
    }
    
    // По умолчанию - для новичков (большинство групп)
    return true;
  }

  /**
   * Очистить названия групп от внутренних обозначений
   */
  cleanGroupNames(groupsArray) {
    return groupsArray.map(group => {
      let cleaned = group;
      
      // 1. Убираем возрастные обозначения
      cleaned = cleaned
        .replace(/\s*\d+\+/gi, '')           // 18+, 16+, 12+
        .replace(/\s*\d+-\d+\s*/g, ' ')      // 7-9, 12-14 лет
        .replace(/\s*\d+\s*лет\s*/gi, ' ')   // 5 лет, 10 лет
        .replace(/\s*от\s*\d+\s*лет\s*/gi, ' ') // от 10 лет
        .replace(/\s*до\s*\d+\s*лет\s*/gi, ' ') // до 16 лет
        .replace(/\(\s*\d+[+-]?\s*\)/g, '')  // (18+), (7-12)
        .replace(/\[\s*\d+[+-]?\s*\]/g, ''); // [18+], [7-12]
      
      // 2. Убираем внутренние обозначения уровня (но учитываем их в логике)
      const levelKeywords = {
        'новички': true,
        'начинающие': true,
        'начальный': true,
        'с нуля': true,
        'база': true,
        'базовый': true,
        'продолжающие': false,
        'продолжающих': false,
        'продвинутый': false,
        'команда': false,
        'pro': false
      };
      
      Object.keys(levelKeywords).forEach(keyword => {
        const regex = new RegExp(`\\s*\\(${keyword}\\)|\\s*${keyword}\\s*`, 'gi');
        cleaned = cleaned.replace(regex, ' ');
      });
      
      // 3. Убираем технические обозначения
      cleaned = cleaned
        .replace(/\s*NEW\s*/gi, ' ')
        .replace(/\s*НОВЫЙ\s*/gi, ' ')
        .replace(/\s*\(2\)/g, ' ')
        .replace(/\s*\d{1,2}[:.]\d{2}\s*[-—]\s*\d{1,2}[:.]\d{2}/g, ' ') // время 18:00-19:00
        .replace(/\(доб\.\s*зан\.\)/gi, ' ')
        .replace(/\(доп\.\s*группа\)/gi, ' ');
      
      // 4. Добавляем эмодзи для наглядности
      if (this.isGroupForBeginners(group)) {
        cleaned = `🎯 ${cleaned.trim()}`;
      } else {
        cleaned = `⭐ ${cleaned.trim()} (требуется подготовка)`;
      }
      
      // 5. Чистим от лишних пробелов и возвращаем
      return cleaned.replace(/\s+/g, ' ').trim();
    });
  }

  /**
   * Получить расписание ТОЛЬКО для новичков (очищенное)
   */
  async getClientSchedule(branch = null) {
    try {
      const schedule = await this.getSchedule();
      const filtered = {};
      
      Object.entries(schedule).forEach(([branchName, groups]) => {
        if (branchName.startsWith('_')) {
          filtered[branchName] = groups; // Метаданные
          return;
        }
        
        // Фильтр по филиалу если указан
        if (branch && !branchName.toLowerCase().includes(branch.toLowerCase())) {
          return;
        }
        
        if (Array.isArray(groups)) {
          // Берем только группы для новичков (первые 8)
          const beginnerGroups = groups
            .filter(group => this.isGroupForBeginners(group))
            .slice(0, 8);
          
          if (beginnerGroups.length > 0) {
            // Очищаем названия
            filtered[branchName] = this.cleanGroupNames(beginnerGroups);
          }
        }
      });
      
      return filtered;
      
    } catch (error) {
      console.error('❌ Ошибка получения клиентского расписания:', error.message);
      return this.getFallbackClientSchedule(branch);
    }
  }

  /**
   * Получить расписание с сайта
   */
  async getSchedule() {
    this.stats.scheduleRequests++;
    
    // Проверяем кэш
    if (this.cache.schedule && (Date.now() - this.cache.timestamp < this.cache.ttl)) {
      console.log('📅 Используем кэшированное расписание');
      return this.cache.schedule;
    }

    try {
      console.log('🌐 Парсим расписание с cosmo.su...');
      const { data } = await axios.get(this.scheduleUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
        }
      });

      const $ = cheerio.load(data);
      const schedule = {};

      // Ищем все текстовые блоки
      const text = $('body').text();
      
      // Филиалы для поиска
      const branches = [
        { name: 'Звёздная', keywords: ['звездн', 'звёздн'] },
        { name: 'Дыбенко', keywords: ['дыбенк'] },
        { name: 'Купчино', keywords: ['купчин'] },
        { name: 'Озерки', keywords: ['озерк'] }
      ];

      // Разбиваем текст на строки
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 10); // Берем только значимые строки

      // Ищем расписание по филиалам
      branches.forEach(branch => {
        const branchLines = lines.filter(line => 
          branch.keywords.some(keyword => line.toLowerCase().includes(keyword))
        );
        
        if (branchLines.length > 0) {
          // Берем первые 15 строк для каждого филиала
          schedule[branch.name] = branchLines.slice(0, 15);
        }
      });

      // Если ничего не нашли, используем fallback
      if (Object.keys(schedule).length === 0) {
        console.log('⚠️ Расписание не найдено, используем fallback');
        return this.getFallbackSchedule();
      }

      // Добавляем метаданные
      schedule._meta = {
        source: this.scheduleUrl,
        fetched_at: new Date().toISOString(),
        parser_version: '1.2',
        note: 'Расписание парсится с сайта студии'
      };

      // Сохраняем в кэш
      this.cache.schedule = schedule;
      this.cache.timestamp = Date.now();
      
      console.log(`✅ Расписание получено. Филиалы: ${Object.keys(schedule).filter(k => !k.startsWith('_')).join(', ')}`);
      return schedule;

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Ошибка парсинга расписания:', error.message);
      return this.getFallbackSchedule();
    }
  }

  /**
   * Получить цены с сайта
   */
  async getPrices() {
    this.stats.priceRequests++;
    
    if (this.cache.prices && (Date.now() - this.cache.timestamp < this.cache.ttl)) {
      return this.cache.prices;
    }

    try {
      console.log('💰 Парсим цены с cosmo.su...');
      const { data } = await axios.get(this.pricesUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(data);
      const prices = {};

      // Ищем заголовки с ценами
      $('h1, h2, h3, h4, strong, b').each((i, element) => {
        const text = $(element).text().trim().toLowerCase();
        if (text.includes('цена') || text.includes('стоимость') || text.includes('абонемент')) {
          const title = $(element).text().trim();
          const content = $(element).nextAll().slice(0, 3).text().trim();
          
          if (content && content.length > 20) {
            prices[title] = content.substring(0, 500);
          }
        }
      });

      // Если не нашли, ищем любые цены
      if (Object.keys(prices).length === 0) {
        const bodyText = $('body').text();
        const priceMatches = bodyText.match(/\d+\s*₽|\d+\s*руб|от\s*\d+/gi);
        
        if (priceMatches) {
          prices['Обнаруженные цены'] = [...new Set(priceMatches)].slice(0, 10).join(', ');
        }
      }

      // Добавляем ссылку всегда
      prices['Сайт с ценами'] = this.pricesUrl;

      this.cache.prices = prices;
      
      console.log(`✅ Цены получены. Найдено: ${Object.keys(prices).length} категорий`);
      return prices;

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Ошибка парсинга цен:', error.message);
      return { 
        'Информация': 'Цены на сайте: ' + this.pricesUrl,
        'Примечание': 'Для точной информации свяжитесь с администратором'
      };
    }
  }

  /**
   * Fallback расписание для клиентов (очищенное)
   */
  getFallbackClientSchedule(branch = null) {
    const fallback = {
      'Звёздная': [
        '🎯 High Heels (высокие каблуки)',
        '🎯 Twerk (тверк)',
        '🎯 Акробатика',
        '🎯 Zumba (зумба)',
        '🎯 Hip-Hop (хип-хоп)',
        '🎯 Jazz Funk (джаз-фанк)'
      ],
      'Дыбенko': [
        '🎯 Hip-Hop (хип-хоп) для начинающих',
        '🎯 Jazz Funk (джаз-фанк)',
        '🎯 Break Dance (брейк-данс)',
        '🎯 Contemporary (контемпорари)',
        '🎯 Latina (латина)'
      ],
      'Купчино': [
        '🎯 Contemporary (контемпорари)',
        '🎯 Shuffle (шаффл)',
        '🎯 Strip Dance (стрип-пластика)',
        '🎯 Акробатика для детей',
        '🎯 Бальные танцы'
      ],
      'Озерки': [
        '🎯 Latina Solo (латина соло)',
        '🎯 Dance Mix (дэнс микс)',
        '🎯 Растяжка',
        '🎯 K-Pop (кей-поп)',
        '🎯 Восточные танцы'
      ],
      '_meta': {
        source: 'fallback',
        fetched_at: new Date().toISOString(),
        note: 'Это общая информация. Актуальное расписание на сайте.'
      }
    };

    // Фильтр по филиалу если указан
    if (branch) {
      const foundBranch = Object.keys(fallback).find(b => 
        b.toLowerCase().includes(branch.toLowerCase()) || 
        branch.toLowerCase().includes(b.toLowerCase())
      );
      
      if (foundBranch && foundBranch !== '_meta') {
        return {
          [foundBranch]: fallback[foundBranch],
          _meta: fallback._meta
        };
      }
    }
    
    return fallback;
  }

  /**
   * Fallback расписание (полное)
   */
  getFallbackSchedule() {
    return {
      'Звёздная': [
        'High Heels 18+ новички Пн, Чт 19:00-20:00',
        'Twerk 16+ начинающие Вт, Пт 18:00-19:00',
        'Акробатика 10+ Ср, Сб 17:00-18:00',
        'Zumba 18+ Вс 12:00-14:00',
        'Hip-Hop 12+ новички Пн, Ср 18:00-19:00'
      ],
      'Дыбенko': [
        'Hip-Hop 12+ новички Пн, Ср 18:00-19:00',
        'Jazz Funk 16+ начинающие Вт, Чт 19:00-20:00',
        'Break Dance 8-14 новички Вт, Сб 17:00-18:00',
        'Contemporary 10+ новички Пт, Вс 15:00-16:00',
        'Latina 18+ новички Ср, Сб 19:00-20:00'
      ],
      'Купчино': [
        'Contemporary 12+ новички Пн, Ср 17:30-18:30',
        'Shuffle 7+ начинающие Вт, Чт 18:00-19:00',
        'Strip Dance 18+ новички Пт 19:00-20:00',
        'Акробатика 5+ дети Сб 11:00-12:00',
        'Бальные танцы 18+ новички Пн, Чт 19:30-20:30'
      ],
      'Озерки': [
        'Latina Solo 18+ новички Вт, Чт 18:30-19:30',
        'Dance Mix 8-12 начинающие Пн, Ср 17:00-18:00',
        'Растяжка 16+ Пт 19:00-20:00',
        'K-Pop 10+ новички Сб 13:00-14:00',
        'Восточные танцы 18+ новички Ср, Сб 20:00-21:00'
      ],
      '_meta': {
        source: 'fallback',
        fetched_at: new Date().toISOString(),
        note: 'Это временное расписание. Проверьте актуальное на сайте.'
      }
    };
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      schedule_requests: this.stats.scheduleRequests,
      price_requests: this.stats.priceRequests,
      errors: this.stats.errors,
      cacheAge: Date.now() - this.cache.timestamp,
      cacheValid: this.cache.timestamp > 0 && (Date.now() - this.cache.timestamp < this.cache.ttl),
      scheduleAvailable: !!this.cache.schedule,
      pricesAvailable: !!this.cache.prices
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
