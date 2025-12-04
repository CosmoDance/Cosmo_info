// schedule-analyzer.js - ЗАПУСТИТЕ ОДИН РАЗ ДЛЯ АНАЛИЗА
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function analyzeCosmoSite() {
  console.log('🔍 Начинаем анализ сайта cosmo.su...\n');
  
  try {
    // 1. Получаем страницу
    const { data } = await axios.get('https://cosmo.su/raspisanie/', {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    
    const $ = cheerio.load(data);
    
    // 2. Сохраняем HTML для ручного анализа
    fs.writeFileSync('cosmo-raspisanie.html', data);
    console.log('✅ HTML страницы сохранен в cosmo-raspisanie.html');
    
    // 3. Анализ структуры
    console.log('\n📊 АНАЛИЗ СТРУКТУРЫ:');
    console.log('='.repeat(50));
    
    // Все таблицы
    const tables = $('table');
    console.log(`\n1. ТАБЛИЦЫ: ${tables.length} шт`);
    tables.each((i, table) => {
      const rows = $(table).find('tr').length;
      const cols = $(table).find('tr:first-child th, tr:first-child td').length;
      console.log(`   Таблица ${i+1}: ${rows} строк, ${cols} колонок`);
    });
    
    // Div с расписанием
    console.log('\n2. DIV-БЛОКИ (ищем по классам):');
    const relevantDivs = $('div').filter((i, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('пн') || text.includes('вт') || text.includes('18:') || text.includes('19:');
    });
    
    console.log(`   Найдено ${relevantDivs.length} потенциальных блоков`);
    relevantDivs.slice(0, 5).each((i, div) => {
      const text = $(div).text().trim().substring(0, 150);
      console.log(`\n   Блок ${i+1}:`);
      console.log(`   ${text}...`);
    });
    
    // 4. Поиск филиалов
    console.log('\n3. ФИЛИАЛЫ:');
    const branches = ['Дыбенко', 'Купчино', 'Звёздная', 'Озерки', 'Дыбенко', 'Купчино', 'Звездная'];
    branches.forEach(branch => {
      if (data.includes(branch)) {
        console.log(`   ✅ "${branch}" найден на странице`);
      }
    });
    
    // 5. Поиск времени
    console.log('\n4. ВРЕМЯ ЗАНЯТИЙ:');
    const timePatterns = [
      /\d{1,2}[:.]\d{2}\s*[-—]\s*\d{1,2}[:.]\d{2}/g,  // 18:00-19:00
      /\d{1,2}[:.]\d{2}/g,                           // 18:00
      /(пн|вт|ср|чт|пт|сб|вс)[.:]?\s*\d{1,2}[:.]\d{2}/gi // пн 18:00
    ];
    
    timePatterns.forEach((pattern, idx) => {
      const matches = data.match(pattern);
      if (matches) {
        const unique = [...new Set(matches)].slice(0, 10);
        console.log(`   Паттерн ${idx+1}: ${unique.join(', ')}`);
      }
    });
    
    // 6. Сохраняем структуру для парсера
    const structure = {
      hasTables: tables.length > 0,
      tableCount: tables.length,
      hasScheduleDivs: relevantDivs.length > 0,
      foundBranches: branches.filter(b => data.includes(b)),
      sampleData: $('body').text().substring(0, 5000)
    };
    
    fs.writeFileSync('site-structure.json', JSON.stringify(structure, null, 2));
    console.log('\n✅ Структура сохранена в site-structure.json');
    console.log('\n📋 РЕКОМЕНДАЦИИ ДЛЯ НАСТРОЙКИ ПАРСЕРА:');
    console.log('='.repeat(50));
    
    if (tables.length > 0) {
      console.log('🎯 Используйте ТАБЛИЧНЫЙ парсер (способ 1)');
    } else if (relevantDivs.length > 0) {
      console.log('🎯 Используйте DIV парсер (способ 2)');
    } else {
      console.log('🎯 Используйте ТЕКСТОВЫЙ парсер (способ 3)');
    }
    
  } catch (error) {
    console.error('❌ Ошибка анализа:', error.message);
    console.log('\n💡 Проверьте:');
    console.log('1. Сайт https://cosmo.su/raspisanie/ доступен');
    console.log('2. Нет блокировки по IP');
    console.log('3. Интернет соединение стабильно');
  }
}

// Запуск анализа
console.log('🚀 Запускаем анализ сайта CosmoDance...');
analyzeCosmoSite();
