const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`Запрос: ${req.url}`);
  
  if (req.url === '/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Получен вопрос:', body);
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ 
        reply: '✅ Сервер работает! Я чат-бот CosmoDance. Задайте ваш вопрос.' 
      }));
    });
  } else {
    // Читаем HTML файл
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Ошибка загрузки страницы');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
  }
});

server.listen(3000, 'localhost', () => {
  console.log('===================================');
  console.log('🚀 СЕРВЕР ЗАПУЩЕН!');
  console.log('📱 Откройте в браузере:');
  console.log('👉 http://localhost:3000');
  console.log('👉 http://127.0.0.1:3000');
  console.log('===================================');
});

// Обработка ошибок
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('❌ Порт 3000 занят! Попробуйте другой порт:');
    console.log('   node simple-server.js 4000');
  } else {
    console.log('❌ Ошибка сервера:', err.message);
  }
});
