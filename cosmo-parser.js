// cosmo-parser.js - Парсер для cosmo.su
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
   * Получить расписание с сайта
   */
  async getSchedule() {
    this.stats.scheduleRequests++;
    
    try {
      console.log('🌐 Парсим расписание с cosmo.su...');
      const { data } = await axios.get(this.scheduleUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'CosmoDance-Bot/2.0 (+https://cosmo-info.onrender.com)'
        }
      });

      const $ = cheerio.load(data);
      const schedule = {};

      // Ищем филиалы
      const branches = ['Звёздная', 'Дыбенко', 'Купчино', 'Озерки'];
      
      // Вариант 1: Ищем по заголовкам h2, h3
      $('h2, h3, h4').each((i, el) => {
        const text = $(el).text().trim();
        branches.forEach(branch => {
          if (text.includes(branch)) {
            schedule[branch] = this.extractScheduleAfter($, el);
          }
        });
      });

      // Вариант 2: Ищем таблицы с расписанием
      if (Object.keys(schedule).length === 0) {
        $('table').each((i, table) => {
          const tableText = $(table).text();
          branches.forEach(branch => {
            if (tableText.includes(branch)) {
              schedule[branch] = this.extractFromTable($, table);
            }
          });
        });
      }

      // Если ничего не нашли - показываем ссылку
      if (Object.keys(schedule).length === 0) {
        schedule._info = 'Расписание на сайте: ' + this.scheduleUrl;
      }

      this.cache.schedule = schedule;
      this.cache.timestamp = Date.now();
      
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
    
    try {
      console.log('💰 Парсим цены с cosmo.su...');
      const { data } = await axios.get(this.pricesUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'CosmoDance-Bot/2.0'
        }
      });

      const $ = cheerio.load(data);
      const prices = {};

      // Ищем секции с ценами
      $('h2, h3').each((i, el) => {
        const title = $(el).text().trim();
        if (title.toLowerCase().includes('цена') || 
            title.toLowerCase().includes('стоимость') ||
            title.toLowerCase().includes('абонемент')) {
          
          const nextContent = $(el).nextUntil('h2, h3').text().trim();
          if (nextContent) {
            prices[title] = nextContent.substring(0, 500);
          }
        }
      });

      // Если не нашли по заголовкам, ищем любые цифры с рублями
      if (Object.keys(prices).length === 0) {
        const text = $('body').text();
        const priceMatches = text.match(/\d+\s*₽|\d+\s*руб|от\s*\d+/gi);
        if (priceMatches) {
          prices['Общая информация'] = 'Цены на сайте: ' + priceMatches.slice(0, 10).join(', ');
        }
      }

      this.cache.prices = prices;
      
      return prices;

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Ошибка парсинга цен:', error.message);
      return { 'Информация': 'Цены на сайте: ' + this.pricesUrl };
    }
  }

  /**
   * Вспомогательные методы
   */
  extractScheduleAfter($, element) {
    const items = [];
    let next = $(element).next();
    
    // Берем несколько следующих элементов
    for (let i = 0; i < 10 && next.length; i++) {
      const text = next.text().trim();
      if (text && text.length > 10) {
        items.push(text);
      }
      next = next.next();
    }
    
    return items.slice(0, 5); // Ограничиваем количество
  }

  extractFromTable($, table) {
    const items = [];
    $(table).find('tr').each((i, row) => {
      const cells = $(row).find('td, th');
      if (cells.length >= 2) {
        const rowText = cells.map((i, cell) => $(cell).text().trim()).get().join(' - ');
        if (rowText && rowText.length > 5) {
          items.push(rowText);
        }
      }
    });
    return items.slice(0, 5);
  }

  getFallbackSchedule() {
    return {
      'Звёздная': [
        'Пн, Чт: 19:00-20:00 - High Heels 18+',
        'Вт, Пт: 18:00-19:00 - Twerk 16+',
        'Ср, Сб: 17:00-18:00 - Акробатика 10+',
        'Воскресенье: 12:00-14:00 - Zumba 18+',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      'Дыбенко': [
        'Пн, Ср: 18:00-19:00 - Hip-Hop 12+',
        'Вт, Чт: 19:00-20:00 - Jazz Funk 16+',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      'Купчино': [
        'Пн, Ср: 17:30-18:30 - Contemporary 12+',
        'Вт, Чт: 18:00-19:00 - Shuffle 7+',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      'Озерки': [
        'Вт, Чт: 18:30-19:30 - Latina Solo 18+',
        'Пн, Ср: 17:00-18:00 - Dance Mix 8-12',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      '_info': 'Это временное расписание. Пожалуйста, проверьте актуальное на сайте.'
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
