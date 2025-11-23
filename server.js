import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// --- служебные пути ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- инициализация ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // принимаем JSON до 2 МБ

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== ЗАГРУЗКА ЛОКАЛЬНЫХ ФАЙЛОВ =====

let KNOWLEDGE_BASE = null;               // вопросы-ответы
let SCHEDULE = null;                     // расписание всех филиалов

async function loadJsonSafe(filePath) {
  try {
    const full = path.join(__dirname, filePath);
    const data = await fs.readFile(full, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.warn(`Не удалось загрузить ${filePath}:`, e.message);
    return null;
  }
}

async function loadAllData() {
  KNOWLEDGE_BASE = await loadJsonSafe("knowledge.json");
  // файл с расписанием всех 4 филиалов, который мы складывали в папку бота
  SCHEDULE = await loadJsonSafe("cosmo_schedule_all_branches_ready.json");
  console.log("Данные загружены:", {
    knowledge: KNOWLEDGE_BASE ? "OK" : "нет",
    schedule: SCHEDULE ? "OK" : "нет",
  });
}

await loadAllData();

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

const FULL_DAY = {
  "Пн": "понедельник",
  "Вт": "вторник",
  "Ср": "среду",
  "Чт": "четверг",
  "Пт": "пятницу",
  "Сб": "субботу",
  "Вс": "воскресенье",
};

function buildScheduleText() {
  if (!SCHEDULE || !Array.isArray(SCHEDULE.groups)) return "";

  const lines = [];
  lines.push(
    "Вот подробное расписание групп студии CosmoDance по филиалам. " +
      "Строго придерживайся его при ответах и ничего не придумывай."
  );

  for (const g of SCHEDULE.groups) {
    const scheduleParts = [];
    if (g.schedule) {
      for (const [shortDay, time] of Object.entries(g.schedule)) {
        if (!time) continue;
        const fullDay = FULL_DAY[shortDay] || shortDay;
        scheduleParts.push(`${fullDay}: ${time}`);
      }
    }

    const line = [
      `Филиал: ${g.branch}`,
      `Группа: ${g.group_name}`,
      g.level ? `Уровень: ${g.level}` : null,
      g.teacher ? `Педагог: ${g.teacher}` : null,
      scheduleParts.length ? `Расписание: ${scheduleParts.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    lines.push(line);
  }

  return "\n\n" + lines.join("\n");
}

// ===== ГЛАВНАЯ СИСТЕМНАЯ ПОДСКАЗКА ДЛЯ МОДЕЛИ =====

const SYSTEM_PROMPT = `
Ты — дружелюбный и внимательный ассистент студии танцев CosmoDance.

Главные правила:

1) Отвечай ТОЛЬКО по теме студии: филиалы, направления, возрастные группы, расписание, абонементы, пробные занятия, правила студии.
   Если вопрос не по теме — мягко отвечай:
   "Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."

2) Всегда учитывай уже полученные ответы пользователя в диалоге.
   НЕЛЬЗЯ задавать один и тот же вопрос дважды, если информация уже уточнена ранее.
   Например:
   - если человек уже указал филиал (Звёздная / Звездная / ЗВЕЗДНОЙ / озерки / купчино / дыбенко и любые близкие варианты),
     больше не спрашивай заново "какой филиал удобнее".
   - если человек написал "5 лет звёздная" или "5 лет, Звездная", ты ДОЛЖЕН понять:
        возраст ребёнка = 5 лет,
        филиал = Звёздная.
   Аналогично обрабатывай ответы "ребёнок", "для ребёнка", "для себя", "я новичок", "только начинаем" и т.п.

3) Работай с расписанием строго по базе, которую я тебе передам отдельно (текст с расписанием).
   - Групповые занятия проходят по фиксированному расписанию, время нельзя выбирать произвольно.
   - Показывай дни недели ПОЛНОСТЬЮ: "понедельник", "вторник" и т.д., без сокращений.
   - Время занятий показывай так, как оно есть в базе (например, "19:00–20:00").

4) Логика подбора:
   - сначала уточни: для кого занятия (взрослый / ребёнок) и возраст;
   - потом филиал (если он ещё не известен);
   - потом интересы: новичок / есть опыт, какие задачи (поддержать форму, пластика, выступления, соревнования и т.п.);
   - затем предложи несколько подходящих направлений ИЗ РАСПИСАНИЯ для выбранного филиала и возраста.
     Для новичков предлагай группы с формулировками "начинающие", "с нуля" и т.п.
   - если возраст 60+ — не предлагай откровенно молодёжные стили вроде стрип-пластики, high heels, жёсткого хип-хопа;
     мягко ориентируй на зумбу, латину, танцевальный фитнес и т.п.

5) Психология и поддержка:
   - если человек переживает, что "там все по 16, а мне 40", объясни, что в группе обычно разный возраст,
     новичок может присоединиться в любой момент, программа адаптируется под уровень,
     хореограф поможет и уделит внимание.
   - если человек переживает, что "я новичок, а группа уже давно занимается",
     успокой, что можно присоединиться, объясни, как это устроено.

6) Пробное занятие и заявка:
   - когда человек уже определился с филиалом, направлением и удобной группой (конкретные дни и время),
     СТРУКТУРНО уточни:
       • имя и фамилию,
       • номер телефона,
       • филиал,
       • направление,
       • конкретную группу (дни недели + время).
   - затем коротко подтвердись, что заявка принята, и скажи:
     "Вам напишет администратор студии в рабочее время для подтверждения записи."

7) Если вопрос сложный или не совсем понятный — сначала попробуй ЛОГИЧНО ответить,
   используя всю базу знаний и расписание. Только если совсем не выходит, используй фразу:
   "Мне не хватает данных, чтобы точно ответить на этот вопрос. Попробуйте переформулировать или задать его администратору студии."

Всегда отвечай на ВЫ, дружелюбно, простым живым языком.
`;

// ===== ОТДАТЬ ВЕБ-СТРАНИЦУ ЧАТА =====

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// ===== ПРИЁМ ЗАГРУЗКИ БАЗЫ (если нужно перезалить knowledge.json / расписание) =====

app.post("/upload", async (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ status: "error", message: "Пустое тело запроса" });
    }

    // Просто сохраняем как knowledge.json — при необходимости можно расширить протокол
    const outPath = path.join(__dirname, "knowledge.json");
    await fs.writeFile(outPath, JSON.stringify(body, null, 2), "utf8");

    KNOWLEDGE_BASE = body;
    console.log("База знаний обновлена через /upload");
    res.json({ status: "ok", message: "База принята и сохранена на сервере" });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res.status(500).json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// ===== ОСНОВНОЙ ЧАТ =====

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: "Пожалуйста, напишите ваш вопрос." });
    }

    let knowledgeText = "";
    if (KNOWLEDGE_BASE && Array.isArray(KNOWLEDGE_BASE.items)) {
      const items = KNOWLEDGE_BASE.items;
      knowledgeText =
        "\n\nВот база вопросов и ответов CosmoDance (используй её, когда это уместно):\n" +
        items
          .map(
            (item, i) =>
              `Q${i + 1}: ${item.question || item.q || ""}\nA${i + 1}: ${
                item.answer || item.a || ""
              }`
          )
          .join("\n\n");
    }

    const scheduleText = buildScheduleText();

    const oaMessages = [
      { role: "system", content: SYSTEM_PROMPT + knowledgeText + scheduleText },
      // далее — весь диалог, который прислал фронт
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: oaMessages,
      temperature: 0.5,
      max_tokens: 800,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте переформулировать вопрос.";

    res.json({ reply });
  } catch (error) {
    console.error("Ошибка в /chat:", error);
    res.status(500).json({
      reply:
        "Извините, сейчас у меня техническая пауза. Попробуйте задать вопрос чуть позже или свяжитесь с администратором студии.",
    });
  }
});

// ===== ОТЧЁТ ПО ДИАЛОГУ (вариант B) =====

app.post("/report", async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.json({ status: "skip" });
    }

    // коротко ужимаем диалог в понятный отчёт
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты помощник администратора студии танцев CosmoDance. " +
            "Тебе передан диалог с клиентом. Сжато опиши суть: кто, возраст, филиал, интересующие направления, " +
            "какая группа/расписание выбраны, оставил ли человек контакты. Формат — короткий текст для администратора.",
        },
        { role: "user", content: JSON.stringify(messages, null, 2) },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const summary =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Не удалось сформировать отчёт по диалогу.";

    // отправка в Telegram — заполняешь свои переменные в Render:
    // TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID (числом)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (tgToken && tgChatId) {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      const body = {
        chat_id: tgChatId,
        text: `Отчёт по диалогу CosmoDance:\n\n${summary}`,
        parse_mode: "HTML",
      };

      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      console.warn("TELEGRAM_BOT_TOKEN или TELEGRAM_ADMIN_CHAT_ID не заданы — отчёт не отправлен");
    }

    res.json({ status: "ok" });
  } catch (e) {
    console.error("Ошибка в /report:", e);
    res.status(500).json({ status: "error" });
  }
});

// ===== ЗАПУСК СЕРВЕРА =====

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
