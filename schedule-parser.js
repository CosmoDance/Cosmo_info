// schedule-parser.js - Упрощенный парсер расписания
import axios from 'axios';
import * as cheerio from 'cheerio';

class CosmoScheduleParser {
  constructor(mode = 'production') {
    this.config = {
      BASE_URL: 'https://cosmo.su/raspisanie/',
      CACHE_TTL: 2 * 60 * 60 * 1000, // 2 часа
      REQUEST_TIMEOUT: 15000
    };
    
    this.mode = mode === 'development' 
      ? { debug: true, cacheEnabled: false }
      : { debug: false, cacheEnabled: true };
    
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
      
      console.log('✅ Расписание успешно обновлено');
      
      return this.filterByBranch(scheduleData, branch);
      
    } catch (error) {
      this.stats.failures++;
      console.error('❌ Ошибка при получении расписания:', error.message);
      
      // Возвращаем кэш или fallback
      return this.cache.data ? this.filterByBranch(this.cache.data, branch) : this.getFallbackSchedule();
    }
  }

  /**
   * Загрузка и парсинг расписания
   */
  async fetchAndParse() {
    try {
      const { data } = await axios.get(this.config.BASE_URL, {
        timeout: this.config.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'CosmoDance-Schedule-Parser/2.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
        }
      });

      const $ = cheerio.load(data);
      const schedule = {};
      
      // Пробуем найти расписание разными способами
      
      // Способ 1: Ищем филиалы в тексте
      const branches = ['Дыбенко', 'Купчино', 'Звёздная', 'Озерки'];
      const text = $('body').text();
      
      branches.forEach(branch => {
        if (text.includes(branch)) {
          schedule[branch] = this.extractScheduleForBranch($, branch);
        }
      });
      
      // Если ничего не нашли, возвращаем fallback
      if (Object.keys(schedule).length === 0) {
        console.log('⚠️ Не удалось распарсить расписание, используем fallback');
        return this.getFallbackSchedule();
      }
      
      // Добавляем метаданные
      schedule._meta = {
        source: this.config.BASE_URL,
        fetched_at: new Date().toISOString(),
        parser_version: '2.0',
        next_update: new Date(Date.now() + this.config.CACHE_TTL).toISOString()
      };
      
      return schedule;
      
    } catch (error) {
      console.error('❌ Ошибка парсинга:', error.message);
      throw error;
    }
  }

  /**
   * Извлечение расписания для конкретного филиала
   */
  extractScheduleForBranch($, branchName) {
    const scheduleItems = [];
    
    // Ищем элементы, содержащие название филиала и время
    $('*').each((i, element) => {
      const text = $(element).text();
      if (text.includes(branchName) || $(element).parent().text().includes(branchName)) {
        // Ищем время в формате ЧЧ:ММ
        const timeMatches = text.match(/\b\d{1,2}[:.]\d{2}\b/g);
        if (timeMatches && timeMatches.length > 0) {
          // Берем контекст вокруг времени
          const context = text.substring(0, 200).trim();
          if (context && context.length > 10) {
            scheduleItems.push(context);
          }
        }
      }
    });
    
    // Если не нашли конкретное расписание, добавляем общую информацию
    if (scheduleItems.length === 0) {
      return [
        `Расписание для филиала ${branchName} доступно на сайте`,
        `Проверьте: ${this.config.BASE_URL}`,
        `Или свяжитесь с администратором`
      ];
    }
    
    // Ограничиваем количество элементов
    return scheduleItems.slice(0, 10);
  }

  /**
   * Fallback расписание (если парсинг не работает)
   */
  getFallbackSchedule() {
    return {
      'Дыбенко': [
        'Понедельник, Среда: 18:00-19:00 - Hip-Hop 12+ (новички)',
        'Вторник, Четверг: 19:00-20:00 - Jazz Funk 16+',
        'Пятница: 17:00-18:00 - Dance Mix 7-9 лет',
        'Суббота: 12:00-13:00 - Брейк-данс 8-14 лет',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      'Купчино': [
        'Понедельник, Среда: 17:30-18:30 - Contemporary 12+',
        'Вторник, Четверг: 18:00-19:00 - Shuffle 7+',
        'Пятница: 19:00-20:00 - Strip Dance 18+',
        'Суббота: 11:00-12:00 - Детская хореография 4-6',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      'Звёздная': [
        'Понедельник, Четверг: 19:00-20:00 - High Heels 18+',
        'Вторник, Пятница: 18:00-19:00 - Twerk 16+',
        'Среда, Суббота: 17:00-18:00 - Акробатика 10+',
        'Воскресенье: 12:00-14:00 - Zumba 18+',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      'Озерки': [
        'Вторник, Четверг: 18:30-19:30 - Latina Solo 18+',
        'Понедельник, Среда: 17:00-18:00 - Dance Mix 8-12',
        'Пятница: 19:00-20:00 - Растяжка 16+',
        'Суббота: 13:00-14:00 - K-Pop 10+',
        'Актуальное расписание: https://cosmo.su/raspisanie/'
      ],
      _meta: {
        source: 'fallback',
        fetched_at: new Date().toISOString(),
        note: 'Используется fallback расписание. Парсинг с сайта не сработал.'
      }
    };
  }

  /**
   * Вспомогательные методы
   */
  shouldUseCache() {
    if (!this.cache.data) return false;
    if (!this.mode.cacheEnabled) return false;
    
    const age = Date.now() - this.cache.timestamp;
    return age < this.cache.ttl;
  }

  filterByBranch(schedule, branch) {
    if (!branch || !schedule) return schedule;
    
    // Ищем филиал по названию
    const branchNames = Object.keys(schedule).filter(key => key !== '_meta');
    const foundBranch = branchNames.find(b => 
      b.toLowerCase().includes(branch.toLowerCase()) || 
      branch.toLowerCase().includes(b.toLowerCase())
    );
    
    if (foundBranch) {
      return {
        [foundBranch]: schedule[foundBranch] || [],
        _meta: schedule._meta
      };
    }
    
    return schedule;
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
        new Date(this.cache.timestamp + this.cache.ttl).toISOString() : null,
      scheduleAvailable: !!this.cache.data
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
