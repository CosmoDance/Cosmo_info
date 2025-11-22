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
app.use(express.json({ limit: "2mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Полные названия дней недели для ответов.
 */
const DAY_FULL = {
  Пн: "понедельник",
  Вт: "вторник",
  Ср: "среду",
  Чт: "четверг",
  Пт: "пятницу",
  Сб: "субботу",
  Вс: "воскресенье",
};

/**
 * Главная системная подсказка для бота.
 *
 * Здесь зашита логика:
 *  - сначала определяем филиал;
 *  - затем направление и для кого (взрослый / ребёнок, возраст, опыт);
 *  - затем подбираем группу по расписанию;
 *  - всегда пишем дни недели полностью, без сокращений.
 */
const SYSTEM_PROMPT = `
Ты — виртуальный ассистент студии танцев CosmoDance.

ГЛАВНЫЕ ПРАВИЛА:
- Отвечай ТОЛЬКО по теме студии CosmoDance и танцев (направления, филиалы, расписание, цены, пробные занятия, правила студии, форматы занятий, соревнования, выступления и т.п.).
- Если вопрос не относится к студии или танцам, мягко отвечай:
  "Я отвечаю только на вопросы о студии CosmoDance. Пожалуйста, задайте вопрос по студии."
- Отвечай на "вы", тепло, дружелюбно, простым человеческим языком.
- Если нужно подключить администратора, пиши:
  "Пожалуйста, оставьте номер телефона, и администратор свяжется с вами."

РАБОТА С РАСПИСАНИЕМ И ГРУППАМИ:
1. Всегда сначала уточняем ФИЛИАЛ:
   "Подскажите, пожалуйста, какой филиал CosmoDance вам удобнее посещать: Звёздная, Озерки, Дыбенко или Купчино?"

2. Затем уточняем, ДЛЯ КОГО занятия:
   - Взрослый или ребёнок.
   - Если ребёнок — обязательно спрашиваем возраст.
   - Можно мягко уточнить, что родитель хочет получить от занятий:
     "Подскажите, пожалуйста, сколько лет ребёнку и что для вас важнее: общее развитие, уверенность, выступления на сцене, соревнования?"

3. Спрашиваем, есть ли ТАНЦЕВАЛЬНЫЙ ОПЫТ:
   - Вопрос: "Есть ли у вас / у ребёнка танцевальный опыт или вы начинающие?"
   - Если есть опыт, можно рассмотреть более сильные группы или команды.
   - Если опыта нет — предлагать начинающие группы.

4. Подбор группы:
   - Используй расписание групп (из базы расписания) с учётом филиала, возраста, уровня и направления.
   - Групповые занятия проходят по ЧЁТКОМУ расписанию (дни и время). В ответе просто говори, что занятия идут в конкретные дни и часы.
   - Не пиши слова "строго по расписанию" — просто естественно описывай дни и время.

5. Команды:
   - Если в названии группы есть слово "команда", это формат для ребят с опытом и, как правило, по отбору.
   - Для команды объясняй, что туда обычно попадают ученики с танцевальным опытом и после кастинга/просмотра.
   - Для полностью новичков предлагай начинающие группы, а не команды.

6. Индивидуальные занятия:
   - Индивидуальные занятия можно проводить в разное время по договорённости с тренером.
   - Формулировка: "Индивидуальные занятия мы подбираем по времени совместно с тренером — под ваш график."

ДНИ НЕДЕЛИ:
- В ответах НИКОГДА не используй сокращения "Пн", "Вт", "Ср" и т.п.
- Всегда пиши дни полностью: понедельник, вторник, среду, четверг, пятницу, субботу, воскресенье.
- Если в расписании внутри базы видишь сокращения "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс", в ответе обязательно заменяй их на полные названия.

ЕСЛИ НЕ ХВАТАЕТ ДАННЫХ:
- Если по базе не удаётся точно подобрать группу, отвечай честно и приглашай связаться с администратором:
  "По расписанию вижу несколько вариантов, но чтобы подобрать максимально точно, лучше уточнить детали у администратора. Пожалуйста, оставьте номер телефона — мы перезвоним и подскажем оптимальную группу."
`;

// Здесь будет лежать загруженная база (FAQ + расписание)
let KNOWLEDGE_BASE = null;

// ----- Отдаём веб-страницу чата -----
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// ----- Принимаем базу знаний от upload.js -----
app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res
        .status(400)
        .json({ status: "error", message: "Пустое тело запроса" });
    }

    KNOWLEDGE_BASE = body;

    let faqCount = null;
    let groupsCount = null;

    if (Array.isArray(body)) {
      faqCount = body.length;
    } else {
      if (Array.isArray(body.faq)) faqCount = body.faq.length;
      if (body.schedule && Array.isArray(body.schedule.groups)) {
        groupsCount = body.schedule.groups.length;
      } else if (Array.isArray(body.groups)) {
        groupsCount = body.groups.length;
      }
    }

    console.log(
      "База знаний обновлена. FAQ:",
      faqCount ?? "—",
      "групп в расписании:",
      groupsCount ?? "—"
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

/**
 * Превращаем FAQ (массив вопросов-ответов) в текст
 */
function buildFaqText(base) {
  if (!base) return "";

  const items = Array.isArray(base) ? base : base.items;
  if (!items || !Array.isArray(items)) return "";

  const blocks = items.map((item, i) => {
    const q = item.question || item.q || "";
    const a = item.answer || item.a || "";
    return `Q${i + 1}: ${q}\nA${i + 1}: ${a}`;
  });

  if (!blocks.length) return "";

  return (
    "\n\nВот внутренняя база вопросов и ответов CosmoDance (используй её как основную фактическую опору, не выдумывай факты):\n" +
    blocks.join("\n\n")
  );
}

/**
 * Превращаем расписание групп в удобный текст
 * БЕРЁМ данные из schedule.groups (cosmo_schedule_all_branches_*.json)
 * и сразу конвертируем дни в полные названия.
 */
function buildScheduleText(scheduleBase) {
  if (!scheduleBase || !Array.isArray(scheduleBase.groups)) return "";

  const lines = [];

  for (const group of scheduleBase.groups) {
    const branch = group.branch || "Филиал не указан";
    const name = group.group_name || "Группа без названия";
    const teacher = group.teacher;
    const level = group.level;
    const isTeam = group.is_team;
    const schedule = group.schedule || {};

    // собираем строки вида: "понедельник 18:00–19:00"
    const dayParts = [];
    for (const [shortDay, time] of Object.entries(schedule)) {
      if (!time) continue;
      const fullDay =
        DAY_FULL[shortDay] ||
        shortDay; /* на всякий случай, если встретится что-то другое */
      dayParts.push(`${fullDay} ${time}`);
    }

    if (!dayParts.length) continue;

    let info = `Филиал: ${branch}. Группа: ${name}.`;
    if (level) info += ` Уровень: ${level}.`;
    if (isTeam) info += ` Это командный состав (для ребят с опытом и отбором).`;
    if (teacher) info += ` Преподаватель: ${teacher}.`;
    info += ` Расписание: ${dayParts.join("; ")}.`;

    lines.push(info);
  }

  if (!lines.length) return "";

  return (
    "\n\nВот подробное расписание групп по филиалам CosmoDance (используй его при подборе групп и ответах по времени занятий):\n" +
    lines.join("\n")
  );
}

// ----- Основной чат -----
app.post("/chat", async (req, res) => {
  try {
    const { userMessage } = req.body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({
        reply: "Пожалуйста, напишите ваш вопрос.",
      });
    }

    // Разбираем, что лежит в KNOWLEDGE_BASE: FAQ и расписание
    let faqBase = null;
    let scheduleBase = null;

    if (KNOWLEDGE_BASE) {
      if (Array.isArray(KNOWLEDGE_BASE)) {
        faqBase = KNOWLEDGE_BASE;
      } else {
        if (Array.isArray(KNOWLEDGE_BASE.faq)) {
          faqBase = KNOWLEDGE_BASE.faq;
        } else if (Array.isArray(KNOWLEDGE_BASE.items)) {
          faqBase = KNOWLEDGE_BASE;
        }

        if (
          KNOWLEDGE_BASE.schedule &&
          Array.isArray(KNOWLEDGE_BASE.schedule.groups)
        ) {
          scheduleBase = KNOWLEDGE_BASE.schedule;
        } else if (Array.isArray(KNOWLEDGE_BASE.groups)) {
          scheduleBase = { groups: KNOWLEDGE_BASE.groups };
        }
      }
    }

    const faqText = buildFaqText(faqBase);
    const scheduleText = buildScheduleText(scheduleBase);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + faqText + scheduleText,
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
        "Извините, сейчас у меня техническая пауза. Попробуйте задать вопрос чуть позже или оставьте номер телефона — администратор свяжется с вами.",
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
