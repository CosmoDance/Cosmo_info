// server.js — ФИНАЛЬНАЯ ВЕРСИЯ ДЛЯ RENDER.COM
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Проверка обязательных переменных
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY не найден!");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS - разрешить всем
app.use(cors());

// Лимит размера запросов
app.use(express.json({ limit: "100kb" }));

// ---------- OpenAI клиент ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Загрузка данных ----------
function loadJSONFile(filename) {
  try {
    if (!fs.existsSync(filename)) {
      console.warn(`⚠️ Файл не найден: ${filename}`);
      return null;
    }
    const data = fs.readFileSync(filename, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${filename}:`, error.message);
    return null;
  }
}

// Загружаем данные
const KNOWLEDGE = loadJSONFile("knowledge.json");
const SCHEDULE = loadJSONFile("cosmo_schedule_all_branches_ready.json");

// Проверяем загрузку
if (!KNOWLEDGE) {
  console.error("❌ Не удалось загрузить knowledge.json");
}
if (!SCHEDULE) {
  console.warn("⚠️ Не удалось загрузить расписание");
}

// ---------- Формирование контекста ----------
function buildScheduleText() {
  if (!SCHEDULE || !Array.isArray(SCHEDULE.groups)) {
    return "Расписание временно недоступно.";
  }

  const DAY_FULL = {
    "Пн": "понедельник", "Вт": "вторник", "Ср": "среда",
    "Чт": "четверг", "Пт": "пятница", "Сб": "суббота", "Вс": "воскресенье",
  };

  return SCHEDULE.groups.slice(0, 10).map((g) => {
    const times = Object.entries(g.schedule || {})
      .map(([shortDay, time]) => {
        const fullDay = DAY_FULL[shortDay] || shortDay;
        return `${fullDay}: ${time}`;
      });

    const scheduleStr = times.length > 0 
      ? times.join(", ")
      : "расписание уточняется";

    return `Филиал: ${g.branch || "не указан"}. Группа: ${g.group_name || "не указана"}. Расписание: ${scheduleStr}.`;
  }).join("\n");
}

function buildKnowledgeText() {
  if (!KNOWLEDGE || !Array.isArray(KNOWLEDGE.docs)) {
    return "Информация о студии временно недоступна.";
  }
  
  return KNOWLEDGE.docs.map(d => `### ${d.title}\n${d.text}`).join("\n\n");
}

function getContext() {
  return `${buildKnowledgeText()}\n\n### Расписание групп:\n${buildScheduleText()}`;
}

// ---------- Системная подсказка ----------
const SYSTEM_PROMPT = `Ты — ассистент студии танцев CosmoDance в Санкт-Петербурге.
Используй информацию из базы знаний. Отвечай вежливо, всегда на "вы".
Если точной информации нет — предложи связаться с администратором.`;

// ---------- Статика и маршруты ----------
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const userMessage = (message || "").trim();
    
    if (!userMessage) {
      return res.json({
        reply: "Пожалуйста, напишите ваш вопрос о студии CosmoDance."
      });
    }

    console.log(`📨 Запрос: "${userMessage.substring(0, 50)}..."`);

    // Формируем сообщения для OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `База знаний студии:\n${getContext()}` },
      { role: "user", content: userMessage }
    ];

    // Вызов OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, не удалось сформировать ответ.";

    console.log(`✅ Ответ: ${reply.substring(0, 50)}...`);

    res.json({ reply });

  } catch (error) {
    console.error("❌ Ошибка:", error);
    
    let errorMessage = "Извините, произошла ошибка. Попробуйте позже.";
    
    if (error.code === 'insufficient_quota') {
      errorMessage = "Превышен лимит запросов. Попробуйте позже.";
    }

    res.json({ reply: errorMessage });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "CosmoDance Chat Bot",
    timestamp: new Date().toISOString(),
    data: {
      knowledge: KNOWLEDGE?.docs?.length || 0,
      schedule: SCHEDULE?.groups?.length || 0
    }
  });
});

// ========== КРИТИЧЕСКИ ВАЖНАЯ ЧАСТЬ ДЛЯ RENDER ==========
const port = process.env.PORT || 10000;
// 🔥 ВАЖНО: '0.0.0.0' вместо 'localhost' для Render
app.listen(port, '0.0.0.0', () => {
  console.log("=".repeat(50));
  console.log(`🚀 CosmoDance Chat Bot ЗАПУЩЕН!`);
  console.log(`📍 Порт: ${port}`);
  console.log(`📡 Хост: 0.0.0.0 (для Render)`);
  console.log(`🌐 Render URL: https://cosmo-info.onrender.com`);
  console.log(`📚 База знаний: ${KNOWLEDGE?.docs?.length || 0} тем`);
  console.log(`📅 Расписание: ${SCHEDULE?.groups?.length || 0} групп`);
  console.log("=".repeat(50));
});
