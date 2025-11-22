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
app.use(express.json({ limit: "2mb" })); // принимаем JSON до 2 МБ

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * База знаний:
 *  - KNOWLEDGE_FAQ  — ответы на типовые вопросы (из knowledge.json)
 *  - SCHEDULE_DATA  — расписание всех филиалов (cosmo_schedule_all_branches_ready.json)
 */
let KNOWLEDGE_FAQ = null;
let SCHEDULE_DATA = null;

// Полные названия дней для вывода расписания
const DAY_FULL = {
  "Пн": "Понедельник",
  "Вт": "Вторник",
  "Ср": "Среда",
  "Чт": "Четверг",
  "Пт": "Пятница",
  "Сб": "Суббота",
  "Вс": "Воскресенье",
};

// ----- ГЛАВНАЯ СИСТЕМНАЯ ПОДСКАЗКА -----
const SYSTEM_PROMPT = `
Ты — виртуальный ассистент студии танцев CosmoDance.

ОБЩИЕ ПРАВИЛА
- Отвечай только по теме студии: направления, филиалы, расписание, цены, пробные занятия,
  абонементы, акции, правила студии, особенности обучения.
- Если вопрос не относится к студии или к танцам, мягко перенаправляй:
  "Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."
- Если нужен живой администратор, пиши:
  "Пожалуйста, оставьте номер телефона, и администратор свяжется с вами."
- Обращайся к пользователю на ВЫ, отвечай тепло, уверенно и простым человеческим языком.

ЛОГИКА ОБЩЕНИЯ С НОВЫМ КЛИЕНТОМ
1) Сначала уточни:
   - какой филиал удобнее посещать: Звёздная, Озерки, Дыбенко или Купчино;
   - для кого занятия: для взрослого или для ребёнка.

2) Если занятия для ребёнка, ОБЯЗАТЕЛЬНО уточни:
   - возраст ребёнка;
   - есть ли танцевальный опыт;
   - что важнее для родителя: общее развитие, уверенность и раскрепощение,
     выступления на сцене, участие в соревнованиях и т.п.

3) Если ответ пришёл одной фразой сразу на несколько вопросов
   (например: "5 лет Звёздная, только начинаем"):
   - вытащи ВСЮ информацию из этой фразы (возраст, филиал, опыт);
   - больше НЕ задавай те вопросы, на которые уже получен ответ.

4) Для взрослых также уточняй танцевальный опыт и цели (для себя/фигура/выступления и т.п.).

РАСПИСАНИЕ И ГРУППЫ
- У тебя есть подробное расписание групп по филиалам.
- Каждая группа жёстко привязана к своему расписанию.
  Не предлагай время "в любое удобное", а подбирай конкретные группы по расписанию.
- Обычно занятия 2 раза в неделю, иногда 3 — ориентируйся на данные из расписания.
- В ответах ВСЕГДА пиши дни недели полностью: "Понедельник", "Вторник" и т.д.,
  даже если в расписании они указаны как "Пн", "Вт" и т.п.
- Сначала помоги выбрать НАПРАВЛЕНИЕ (например, хип-хоп, брейк-данс, джаз-фанк и т.п.),
  затем предложи конкретные группы по расписанию (дни недели и время).
- Группы, в названии которых есть "Команда", предназначены для учеников с опытом
  и принимают по кастингу. Новичкам такие группы не предлагай, а объясняй, что сначала
  нужно походить в начинающую группу.

РАБОТА С БАЗОЙ ЗНАНИЙ
- В базе знаний есть типовые вопросы и ответы по студии — используй их как основу.
- Если в базе есть точный ответ — опирайся на него.
- Если в базе нет точного ответа, но есть расписание и общая информация, —
  подбирай ответ логично и честно, без выдумывания несуществующих филиалов или цен.

ФОРМАТ ОТВЕТОВ
- Пиши структурированно, короткими абзацами.
- Если предлагаешь варианты групп, перечисляй их в виде списка:
  • Филиал, направление, возраст/уровень,
    дни недели (полностью) и время, преподаватель (если есть).
- Не повторяй вопросы, на которые пользователь уже чётко ответил.
`;

// ----- ОТДАТЬ ВЕБ-СТРАНИЦУ ЧАТА -----
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// ----- ПРИНЯТЬ БАЗУ ЗНАНИЙ ОТ upload.js -----
app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res
        .status(400)
        .json({ status: "error", message: "Пустое тело запроса" });
    }

    // ожидаем структуру { faq: ..., schedule: ... }
    KNOWLEDGE_FAQ = body.faq ?? null;
    SCHEDULE_DATA = body.schedule ?? null;

    let faqCount = null;
    if (Array.isArray(KNOWLEDGE_FAQ)) {
      faqCount = KNOWLEDGE_FAQ.length;
    }

    let scheduleCount = null;
    if (Array.isArray(SCHEDULE_DATA)) {
      scheduleCount = SCHEDULE_DATA.length;
    } else if (SCHEDULE_DATA && SCHEDULE_DATA.groups) {
      scheduleCount = SCHEDULE_DATA.groups.length;
      SCHEDULE_DATA = SCHEDULE_DATA.groups;
    }

    console.log(
      "База знаний обновлена. FAQ:",
      faqCount ?? "нет",
      "групп в расписании:",
      scheduleCount ?? "нет"
    );

    res.json({
      status: "ok",
      message: "База принята на сервере",
      faqCount,
      scheduleCount,
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res
      .status(500)
      .json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// ----- ОСНОВНОЙ ЧАТ -----
app.post("/chat", async (req, res) => {
  try {
    const { userMessage } = req.body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос.",
      });
    }

    // ---- ТЕКСТ ИЗ FAQ ----
    let knowledgeText = "";
    if (KNOWLEDGE_FAQ) {
      const items = Array.isArray(KNOWLEDGE_FAQ)
        ? KNOWLEDGE_FAQ
        : KNOWLEDGE_FAQ.items || [];
      if (items.length > 0) {
        knowledgeText =
          "\n\nВот база вопросов и ответов по студии CosmoDance (используй их максимально точно):\n" +
          items
            .map(
              (item, i) =>
                `Q${i + 1}: ${item.question || item.q || ""}\nA${
                  i + 1
                }: ${item.answer || item.a || ""}`
            )
            .join("\n\n");
      }
    }

    // ---- ТЕКСТ ИЗ РАСПИСАНИЯ ----
    let scheduleText = "";
    if (SCHEDULE_DATA && Array.isArray(SCHEDULE_DATA) && SCHEDULE_DATA.length) {
      const lines = SCHEDULE_DATA.map((g, i) => {
        const branch = g.branch || "";
        const name = g.group_name || g.name || "";
        const teacher = g.teacher || "";
        const level = g.level || "";
        const isTeam = g.is_team ? " (команда, по кастингу)" : "";
        const schedule = g.schedule || {};

        const times = Object.entries(schedule)
          .filter(([_, time]) => time && String(time).trim() !== "" && time !== "-")
          .map(([shortDay, time]) => {
            const fullDay = DAY_FULL[shortDay] || shortDay;
            return `${fullDay}: ${time}`;
          })
          .join("; ");

        return `Группа ${i + 1}.
Филиал: ${branch}.
Направление/группа: ${name}${isTeam}.
Уровень: ${level || "не указан"}.
Преподаватель: ${teacher || "не указан"}.
Расписание: ${times || "нет данных"}.`;
      });

      scheduleText =
        "\n\nВот подробное расписание групп CosmoDance по филиалам. Используй его, чтобы подбирать конкретные группы и времена занятий:\n\n" +
        lines.join("\n\n");
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + knowledgeText + scheduleText,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.6,
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

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
