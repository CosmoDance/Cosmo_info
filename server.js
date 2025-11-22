import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // JSON до 2 МБ

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ───────── СИСТЕМНАЯ ПОДСКАЗКА ДЛЯ МОДЕЛИ ───────── */

const SYSTEM_PROMPT = `
Ты — дружелюбный ассистент студии танцев CosmoDance.

Главные принципы:

1) Отвечай ТОЛЬКО по теме студии:
   - направления и стили танцев;
   - филиалы (Звёздная / Звездная, Озерки, Дыбенко, Купчино);
   - расписание групп, возраст, уровень;
   - пробные занятия;
   - цены и абонементы;
   - правила студии, форма одежды, посещаемость;
   - индивидуальные занятия.

2) Всегда учитывай предыдущие сообщения пользователя.
   - Не задавай один и тот же уточняющий вопрос дважды,
     если уже получил понятный ответ.
   - Пользователь может отвечать на несколько вопросов в одной фразе,
     например: "5 лет звездная" или "Для ребёнка 7 лет, звёздная".
     В таких случаях сам выделяй:
       • филиал,
       • возраст,
       • есть ли танцевальный опыт,
       • цели (если он их назвал).

3) Филиалы воспринимай независимо от ё/е и регистра:
   "Звездная", "звёздная", "звездное" — всё это филиал Звёздная.
   То же самое с другими филиалами: Озерки / озёрки, Дыбенко, Купчино.

4) Логика подбора групп:
   - Сначала помоги определиться с филиалом.
   - Затем уточни, для кого занятия (взрослый или ребёнок).
   - Если для ребёнка:
       • спроси возраст,
       • спроси, есть ли танцевальный опыт (или мы только начинаем).
     НЕ спрашивай про "что важнее: развитие / сцена / соревнования" —
     эту тему пока не поднимаем.
   - Исходя из филиала, возраста, опыта и направления
     предложи подходящие группы из расписания.

5) Про расписание:
   - Групповые занятия проходят по фиксированному расписанию
     (2–3 раза в неделю). Не пиши слова "строго", просто объясни,
     что посещение привязано к конкретным дням и времени.
   - Индивидуальные занятия можно согласовывать в разное время
     с тренером отдельно.

6) Формат дней недели:
   - Всегда пиши дни полностью: "понедельник", "вторник", "среда", 
     "четверг", "пятница", "суббота", "воскресенье".
   - Если в базе день обозначен как "Пн", "Вт" и т.п.,
     в ответе всё равно используй полные названия.

7) Общий стиль:
   - обращение на ВЫ;
   - тёплый, поддерживающий тон, но без сюсюканья;
   - объясняй простым человеческим языком;
   - ответы делай структурированными и понятными.

Если вопрос не относится к студии или к танцам, мягко отвечай:
"Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."

Если нужно подключить администратора, пиши:
"Пожалуйста, оставьте номер телефона, и администратор свяжется с вами."
`;

/* ───────── ПАМЯТЬ О БАЗЕ ЗНАНИЙ (FAQ + РАСПИСАНИЕ) ───────── */

let KNOWLEDGE_BASE = null;

/**
 * Превращаем KNOWLEDGE_BASE в текст, который модель будет использовать.
 * Структура:
 * {
 *   faq: [ { question, answer }, ... ],
 *   schedule: { groups: [ { branch, group_name, teacher, level, is_team, schedule: {Пн: '19:00-20:00', ...} } ] }
 * }
 */
function buildKnowledgeText() {
  if (!KNOWLEDGE_BASE) return "";

  let parts = [];

  // 1) FAQ
  const faq =
    KNOWLEDGE_BASE.faq ||
    KNOWLEDGE_BASE.items ||
    (Array.isArray(KNOWLEDGE_BASE) ? KNOWLEDGE_BASE : null);

  if (faq && Array.isArray(faq) && faq.length > 0) {
    const faqText =
      "\n\nВот вопросы и ответы по студии CosmoDance. Используй их максимально точно:\n\n" +
      faq
        .map((item, i) => {
          const q = item.question || item.q || "";
          const a = item.answer || item.a || "";
          return `Q${i + 1}: ${q}\nA${i + 1}: ${a}`;
        })
        .join("\n\n");
    parts.push(faqText);
  }

  // 2) Расписание
  const schedule = KNOWLEDGE_BASE.schedule;
  if (schedule && Array.isArray(schedule.groups) && schedule.groups.length > 0) {
    const mapDays = {
      Пн: "понедельник",
      Вт: "вторник",
      Ср: "среда",
      Чт: "четверг",
      Пт: "пятница",
      Сб: "суббота",
      Вс: "воскресенье",
    };

    const groupsText =
      "\n\nНиже подробное расписание групп по филиалам. Используй его при подборе вариантов:\n\n" +
      schedule.groups
        .map((g, idx) => {
          const branch = g.branch || "";
          const name = g.group_name || "";
          const teacher = g.teacher ? `Педагог: ${g.teacher}. ` : "";
          const level = g.level ? `Уровень: ${g.level}. ` : "";
          const teamNote = g.is_team
            ? "Тип: команда (по отбору, для учеников с опытом). "
            : "";
          const scheduleLines = [];

          if (g.schedule && typeof g.schedule === "object") {
            for (const [shortDay, time] of Object.entries(g.schedule)) {
              if (!time) continue;
              const fullDay = mapDays[shortDay] || shortDay;
              scheduleLines.push(`${fullDay}: ${time}`);
            }
          }

          const scheduleText =
            scheduleLines.length > 0
              ? "Занятия: " + scheduleLines.join(", ") + ". "
              : "";

          return `Группа ${idx + 1}.\nФилиал: ${branch}.\nНазвание: ${name}.\n${teacher}${level}${teamNote}${scheduleText}`;
        })
        .join("\n\n");

    parts.push(groupsText);
  }

  return parts.join("\n");
}

/* ───────── ОТДАТЬ HTML СТРАНИЦУ ЧАТА ───────── */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

/* ───────── ПРИНЯТЬ БАЗУ ЗНАНИЙ ОТ upload.js ───────── */

app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res
        .status(400)
        .json({ status: "error", message: "Пустое тело запроса" });
    }

    KNOWLEDGE_BASE = body;

    let faqCount = 0;
    const faq =
      body.faq ||
      body.items ||
      (Array.isArray(body) ? body : null);
    if (faq && Array.isArray(faq)) faqCount = faq.length;

    let groupsCount = 0;
    if (body.schedule && Array.isArray(body.schedule.groups)) {
      groupsCount = body.schedule.groups.length;
    }

    console.log(
      "База знаний обновлена.",
      "FAQ:", faqCount,
      "групп в расписании:", groupsCount
    );

    res.json({
      status: "ok",
      message: "База принята на сервере",
      faqCount,
      groupsCount,
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res
      .status(500)
      .json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

/* ───────── ОСНОВНОЙ ЧАТ ───────── */

app.post("/chat", async (req, res) => {
  try {
    const { messages, userMessage } = req.body || {};

    let userHistory = [];

    // Новый формат: клиент присылает весь диалог { role, content }
    if (Array.isArray(messages) && messages.length > 0) {
      userHistory = messages
        .filter(
          (m) =>
            m &&
            typeof m.role === "string" &&
            typeof m.content === "string"
        )
        .map((m) => ({ role: m.role, content: m.content }));
    } else if (typeof userMessage === "string" && userMessage.trim()) {
      // Старый формат на всякий случай
      userHistory = [{ role: "user", content: userMessage.trim() }];
    } else {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос.",
      });
    }

    const knowledgeText = buildKnowledgeText();

    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT + knowledgeText },
      ...userHistory,
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: openaiMessages,
      temperature: 0.5,
      max_tokens: 700,
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

/* ───────── ЗАПУСК ───────── */

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
