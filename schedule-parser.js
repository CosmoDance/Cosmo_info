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

      console.log('🔍 Анализируем структуру страницы...');

      // Способ 1: Ищем по структуре сайта (адаптируйте под ваш сайт)
      
      // Ищем все текстовые блоки, содержащие время
      $('body *').each((i, element) => {
        const text = $(element).text().trim();
        const html = $(element).html();
        
        // Если есть время в формате ЧЧ:ММ
        if (text && /\d{1,2}[:.]\d{2}/.test(text) && text.length < 500) {
          
          // Проверяем, к какому филиалу относится
          const branches = [
            { name: 'Звёздная', keywords: ['звездн', 'звёздн'] },
            { name: 'Дыбенко', keywords: ['дыбенк'] },
            { name: 'Купчино', keywords: ['купчин'] },
            { name: 'Озерки', keywords: ['озерк'] }
          ];
          
          for (const branch of branches) {
            if (branch.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
              if (!schedule[branch.name]) {
                schedule[branch.name] = [];
              }
              
              // Очищаем текст от лишних пробелов
              const cleanText = text.replace(/\s+/g, ' ').trim();
              if (cleanText.length > 10 && !schedule[branch.name].includes(cleanText)) {
                schedule[branch.name].push(cleanText);
              }
              break;
            }
          }
        }
      });

      // Если ничего не нашли структурированно, ищем любое расписание
      if (Object.keys(schedule).length === 0) {
        console.log('⚠️ Структурированное расписание не найдено, используем текстовый поиск');
        
        // Ищем все, что похоже на расписание
        const allText = $('body').text();
        const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        lines.forEach(line => {
          if (line.includes(':') && (line.includes('Пн') || line.includes('Вт') || line.includes('пн') || line.includes('вт'))) {
            // Это похоже на расписание
            const branches = ['Звёздная', 'Дыбенко', 'Купчино', 'Озерки'];
            branches.forEach(branch => {
              if (line.includes(branch)) {
                if (!schedule[branch]) schedule[branch] = [];
                schedule[branch].push(line);
              }
            });
          }
        });
      }

      // Если все еще пусто, создаем информативный ответ
      if (Object.keys(schedule).length === 0) {
        console.log('📄 Расписание в явном виде не найдено, создаем информационный ответ');
        schedule['Информация'] = [
          'Расписание доступно на сайте студии',
          'Ссылка: https://cosmo.su/raspisanie/',
          'Для уточнения расписания свяжитесь с администратором'
        ];
        
        // Добавляем филиалы для информации
        schedule['Филиалы'] = ['Дыбенко', 'Купчино', 'Звёздная', 'Озерки'];
      }

      // Ограничиваем количество записей на филиал
      Object.keys(schedule).forEach(branch => {
        if (Array.isArray(schedule[branch])) {
          schedule[branch] = schedule[branch].slice(0, 10);
        }
      });

      // Добавляем метаданные
      schedule._meta = {
        source: this.scheduleUrl,
        fetched_at: new Date().toISOString(),
        parser_version: '1.0',
        note: 'Расписание парсится с сайта студии'
      };

      this.cache.schedule = schedule;
      this.cache.timestamp = Date.now();
      
      console.log(`✅ Расписание получено. Найдено филиалов: ${Object.keys(schedule).filter(k => !k.startsWith('_')).length}`);
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

      // Ищем цены разными способами
      
      // 1. Ищем по заголовкам
      $('h1, h2, h3, h4, strong, b').each((i, element) => {
        const text = $(element).text().trim().toLowerCase();
        if (text.includes('цена') || text.includes('стоимость') || text.includes('абонемент')) {
          const content = this.extractPriceContent($, element);
          if (content) {
            const title = $(element).text().trim();
            prices[title] = content;
          }
        }
      });

      // 2. Ищем цифры с рублями
      const bodyText = $('body').text();
      const pricePatterns = [
        /\d+\s*₽/g,
        /\d+\s*руб/g,
        /от\s*\d+/gi,
        /\d+\s*р\./g
      ];
      
      const foundPrices = [];
      pricePatterns.forEach(pattern => {
        const matches = bodyText.match(pattern);
        if (matches) {
          foundPrices.push(...matches.slice(0, 20));
        }
      });

      if (foundPrices.length > 0) {
        prices['Обнаруженные цены'] = [...new Set(foundPrices)].join(', ');
      }

      // 3. Ищем таблицы с ценами
      $('table').each((i, table) => {
        const tableText = $(table).text().toLowerCase();
        if (tableText.includes('цена') || tableText.includes('руб') || tableText.includes('₽')) {
          const rows = [];
          $(table).find('tr').each((j, row) => {
            const rowText = $(row).text().trim();
            if (rowText && rowText.length > 5) {
              rows.push(rowText);
            }
          });
          if (rows.length > 0) {
            prices[`Таблица цен ${i + 1}`] = rows.join('\n');
          }
        }
      });

      // Если ничего не нашли
      if (Object.keys(prices).length === 0) {
        prices['Информация'] = 'Цены доступны на сайте: ' + this.pricesUrl;
        
        // Ищем любую информацию о стоимости
        const paragraphs = $('p').map((i, p) => $(p).text().trim()).get();
        const priceParagraphs = paragraphs.filter(p => 
          p.includes('руб') || p.includes('₽') || p.includes('стоимость')
        );
        
        if (priceParagraphs.length > 0) {
          prices['Информация о ценах'] = priceParagraphs.slice(0, 3).join('\n\n');
        }
      }

      // Ограничиваем длину
      Object.keys(prices).forEach(key => {
        if (prices[key].length > 1000) {
          prices[key] = prices[key].substring(0, 1000) + '...';
        }
      });

      this.cache.prices = prices;
      
      console.log(`✅ Цены получены. Найдено категорий: ${Object.keys(prices).length}`);
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
   * Вспомогательные методы
   */
  extractPriceContent($, element) {
    let content = '';
    let current = $(element).next();
    
    // Собираем следующих 5 элементов
    for (let i = 0; i < 5 && current.length; i++) {
      const text = current.text().trim();
      if (text && text.length > 10) {
        content += text + '\n\n';
      }
      current = current.next();
    }
    
    return content || $(element).parent().text().trim();
  }

  getFallbackSchedule() {
    return {
      'Звёздная': [
        'Актуальное расписание на сайте: https://cosmo.su/raspisanie/',
        'Обычное время занятий: будни 18:00-22:00, выходные 10:00-20:00',
        'Направления: Hip-Hop, Jazz Funk, High Heels, Twerk, Zumba',
        'Для точного расписания свяжитесь с администратором'
      ],
      'Дыбенко': [
        'Актуальное расписание на сайте: https://cosmo.su/raspisanie/',
        'Обычное время занятий: будни 17:00-21:00, выходные 11:00-19:00',
        'Направления: Break Dance, Contemporary, Dance Mix, Latina',
        'Для точного расписания свяжитесь с администратором'
      ],
      'Купчино': [
        'Актуальное расписание на сайте: https://cosmo.su/raspisanie/',
        'Обычное время занятий: будни 16:00-22:00, выходные 10:00-18:00',
        'Направления: Hip-Hop, Shuffle, Strip, Акробатика',
        'Для точного расписания свяжитесь с администратором'
      ],
      'Озерки': [
        'Актуальное расписание на сайте: https://cosmo.su/raspisanie/',
        'Обычное время занятий: будни 17:00-21:00, выходные 12:00-16:00',
        'Направления: Latina Solo, Dance Mix, Растяжка, K-Pop',
        'Для точного расписания свяжитесь с администратором'
      ],
      '_meta': {
        source: 'fallback',
        fetched_at: new Date().toISOString(),
        note: 'Это общая информация. Проверьте актуальное расписание на сайте.'
      }
    };
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      ...this.stats,
      cacheAge: Date.now() - this.cache.timestamp,
      cacheValid: this.cache.timestamp > 0 && (Date.now() - this.cache.timestamp < this.cache.ttl)
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
