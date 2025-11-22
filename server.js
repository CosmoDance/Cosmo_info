import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ---------------- БАЗОВАЯ НАСТРОЙКА ----------------

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // принимаем JSON до 2 МБ

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------------- ЗАГРУЖАЕМ РАСПИСАНИЕ 4 ФИЛИАЛОВ ---------------

let SCHEDULE = null;
let SCHEDULE_TEXT = "";

try {
  const raw = fs.readFileSync(
    path.join(__dirname, "cosmo_schedule_all_branches_ready.json"),
    "utf8"
  );
  SCHEDULE = JSON.parse(raw);
  SCHEDULE_TEXT = JSON.stringify(SCHEDULE, null, 2);
  const groupsCount = Array.isArray(SCHEDULE.groups)
    ? SCHEDULE.groups.length
    : "unknown";
  console.log("Schedule loaded, groups:", groupsCount);
} catch (e) {
  console.error("Не удалось загрузить расписание:", e.message);
}

// --------------- БАЗА ВОПРОСОВ/ОТВЕТОВ (upload.js) ---------------

let KNOWLEDGE_BASE = null;

function buildKnowledgeText() {
  if (!KNOWLEDGE_BASE) return "";

  let items = [];

  if (Array.isArray(KNOWLEDGE_BASE)) {
    items = KNOWLEDGE_BASE;
  } else if (KNOWLEDGE_BASE.items && Array.isArray(KNOWLEDGE_BASE.items)) {
    items = KNOWLEDGE_BASE.items;
  }

  // Ограничим, чтобы не перегружать модель
  const limited = items.slice(0, 120);

  const text =
    "\n\nВот база знаний CosmoDance (вопросы и ответы, используй их точно):\n" +
    limited
      .map(
        (item, i) =>
          `Q${i + 1}: ${item.question || item.q || ""}\nA${i + 1}: ${
            item.answer || item.a || ""
          }`
      )
      .join("\n\n");

  return text;
}

// --------------- СИСТЕМНЫЙ ПРОМПТ ---------------

const SYSTEM_PROMPT = `
Ты — дружелюбный ассистент студии танцев CosmoDance.

Главные правила:

1) Отвечай ТОЛЬКО по теме студии CosmoDance:
   – направления и стили;
   – филиалы (Звёздная, Озерки, Дыбенко, Купчино);
   – расписание групп и как добраться;
   – цены, акции, пробные занятия;
   – правила студии, возрастные ограничения и т.п.

2) Ты всегда в контексте ДИАЛОГА:
   – учитывай ВСЕ предыдущие сообщения пользователя;
   – не задавай один и тот же вопрос дважды, если ответ уже был;
   – короткие ответы типа "звездная", "ребенок", "5 лет", "5 лет звездная",
     "я новичок", "опыт есть" и т.п. обязан правильно понимать.
   – учитывай, что человек может написать филиал с ошибкой:
     "звезная", "звездная", "звёздная" — это всё филиал Звёздная.

3) Логика подбора занятия:
   – сначала пойми: для кого занятие (взрослый / ребёнок), возраст и филиал;
   – если для ребёнка — уточни возраст и есть ли танцевальный опыт;
   – если для взрослого — можно спросить про цели (фигура, пластика, сцена и т.п.);
   – подбирай НАПРАВЛЕНИЯ и КОНКРЕТНЫЕ ГРУППЫ строго по расписанию:
     каждая группа жёстко привязана к дням и времени, "любое время" писать нельзя;
   – групповые занятия идут по расписанию 2–3 раза в неделю;
   – индивидуальные занятия могут быть в разное время по договорённости с тренером.

4) Возрастные моменты:
   – обозначение "16+" означает, что в группе могут заниматься ВСЕ взрослые от 16 лет и старше.
     Если человеку 30, 40, 50 лет — такие группы ему подходят.
   – не нужно пугать возрастом: подчеркни, что в группах обычно разный возраст.
   – если пользователю 60+ или 70+, в приоритете мягкие направления:
     зумба, латина, фитнес-направления. Избегай слишком "молодёжных" стилей
     вроде стрип-пластики, heels, жёсткого хип-хопа и т.п., если человек явно
     не просит именно это.

5) Расписания:
   – использовать расписание, которое я тебе передаю отдельным системным сообщением;
   – предлагай все подходящие группы для новичков/начинающих, а не только одну-две;
   – в ответе показывай:
       • название направления/группы;
       • дни недели ПОЛНОСТЬЮ словами (понедельник, вторник и т.д.);
       • время занятий;
       • филиал, если это важно.

6) Начинающие:
   – слова "новичок", "с нуля", "никогда не занимался" = начинающий уровень;
   – начинающим НЕ предлагай "команды" — команды только по отбору и для опытных.

7) Манера общения:
   – обращение на ВЫ, тепло и поддерживающе;
   – помогай психологически: сними страх "я ничего не умею", "я старше остальных";
   – объясняй, что программа адаптируется под уровень, влиться в группу можно на любом этапе;
   – в конце логичного подбора предлагаешь пробное занятие.

8) Запись на пробное:
   – когда человек говорит, что готов, обязательно уточни:
     имя, фамилию (или хотя бы имя) и номер телефона;
   – зафиксируй выбранный филиал, направление и расписание группы в одном
     коротком резюме "заявки" в конце сообщения;
   – пока просто сформируй понятный текст заявки, который можно будет
     вручную переслать администратору.

9) Если вопрос не по студии:
   – мягко отвечай: "Я отвечаю только на вопросы о студии CosmoDance.
     Пожалуйста, задайте вопрос по студии."

10) Ошибки и непонимание:
   – если вопрос непонятен, постарайся аккуратно переформулировать
     и переспросить;
   – фразу про "техническую паузу" используй ТОЛЬКО если действительно
     произошла техническая ошибка;
   – если не хватает информации, попроси уточнить, а не говори, что "не знаю".
`;

// --------------- ОТДАТЬ ВЕБ-СТРАНИЦУ ЧАТА ---------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// --------------- ПРИНЯТЬ БАЗУ ЗНАНИЙ ОТ upload.js ---------------

app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res
        .status(400)
        .json({ status: "error", message: "Пустое тело запроса" });
    }

    KNOWLEDGE_BASE = body;
    console.log("База знаний обновлена через /upload");

    let count = null;
    if (Array.isArray(body)) count = body.length;
    else if (body.items && Array.isArray(body.items)) count = body.items.length;

    res.json({ status: "ok", message: "База принята на сервере", count });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res
      .status(500)
      .json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// --------------- ЧАТ ----------------

app.post("/chat", async (req, res) => {
  try {
    const { history, userMessage } = req.body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return res.json({ reply: "Пожалуйста, напишите ваш вопрос." });
    }

    const chatHistory = Array.isArray(history) ? history : [];

    const messages = [];

    // системные подсказки
    messages.push({ role: "system", content: SYSTEM_PROMPT });

    if (SCHEDULE_TEXT) {
      messages.push({
        role: "system",
        content:
          "Вот актуальное расписание всех групп CosmoDance по 4 филиалам " +
          "в формате JSON. Используй его, чтобы подбирать конкретные группы " +
          "и время, но в ответе не читай JSON целиком, а красиво оформляй:" +
          "\n\n" +
          SCHEDULE_TEXT,
      });
    }

    const knowledgeText = buildKnowledgeText();
    if (knowledgeText) {
      messages.push({
        role: "system",
        content: knowledgeText,
      });
    }

    // Вся история диалога
    for (const m of chatHistory) {
      if (!m || !m.role || !m.content) continue;
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content),
      });
    }

    // Текущее сообщение пользователя (добавляем последним)
    messages.push({ role: "user", content: userMessage });

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.5,
      max_tokens: 900,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте переформулировать вопрос.";

    res.json({ reply });
  } catch (error) {
    console.error("Ошибка в /chat:", error);
    res.json({
      reply:
        "Сейчас я не могу обработать запрос. Попробуйте переформулировать вопрос чуть позже или свяжитесь с администратором студии.",
    });
  }
});

// --------------- ЗАПУСК СЕРВЕРА ---------------

const port = process.env.PORT || 10000;

app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
