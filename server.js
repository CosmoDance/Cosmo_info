// server.mjs
// Полный сервер для CosmoDance: чат + загрузка базы + использование расписания

import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // принимаем JSON до 2 МБ

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------- ЗАГРУЗКА БАЗЫ ЗНАНИЙ И РАСПИСАНИЯ ИЗ JSON-ФАЙЛОВ ----------

let KNOWLEDGE_TEXT = "";
let SCHEDULE = null;
let SCHEDULE_TEXT = "";

// читаем cosmo-knowledge-full.json (если есть)
try {
  const kbRaw = fs.readFileSync(
    path.join(__dirname, "cosmo-knowledge-full.json"),
    "utf-8"
  );
  const kb = JSON.parse(kbRaw);
  if (kb.docs && Array.isArray(kb.docs)) {
    KNOWLEDGE_TEXT =
      "\n\nБаза знаний CosmoDance (внутренняя информация, используй её ТОЛЬКО для ответов о студии):\n" +
      kb.docs
        .map(
          (doc) =>
            `# ${doc.title || ""}\n` +
            `${typeof doc.text === "string" ? doc.text : ""}`
        )
        .join("\n\n");
    console.log("База знаний загружена из cosmo-knowledge-full.json");
  } else {
    console.log(
      "cosmo-knowledge-full.json найден, но структура docs не распознана"
    );
  }
} catch (e) {
  console.log(
    "Не удалось прочитать cosmo-knowledge-full.json (это не ошибка, просто файл не найден или пустой):",
    e.message
  );
}

// читаем cosmo_schedule_all_branches_ready.json (если есть)
try {
  const schedRaw = fs.readFileSync(
    path.join(__dirname, "cosmo_schedule_all_branches_ready.json"),
    "utf-8"
  );
  SCHEDULE = JSON.parse(schedRaw);

  if (SCHEDULE && Array.isArray(SCHEDULE.groups)) {
    // Делаем человекочитаемый текст расписания
    const lines = [];
    for (const g of SCHEDULE.groups) {
      const branch = g.branch || "Филиал";
      const name = g.group_name || "Группа";
      const teacher = g.teacher ? `, педагог: ${g.teacher}` : "";
      const level = g.level ? `, уровень: ${g.level}` : "";
      const sched = g.schedule || {};
      const daysParts = [];
      const dayMap = {
        Пн: "понедельник",
        Вт: "вторник",
        Ср: "среду",
        Чт: "четверг",
        Пт: "пятницу",
        Сб: "субботу",
        Вс: "воскресенье",
      };

      for (const shortDay of Object.keys(dayMap)) {
        const val = sched[shortDay];
        if (val) {
          daysParts.push(`${dayMap[shortDay]}: ${val}`);
        }
      }

      const daysText =
        daysParts.length > 0
          ? " (занятия: " + daysParts.join("; ") + ")"
          : "";

      lines.push(
        `Филиал: ${branch}. Группа: ${name}${teacher}${level}${daysText}.`
      );
    }

    SCHEDULE_TEXT =
      "\n\nРасписание групп CosmoDance по филиалам (используй только по запросу клиента, не придумывай своё расписание):\n" +
      lines.join("\n");
    console.log(
      "Расписание загружено из cosmo_schedule_all_branches_ready.json"
    );
  } else {
    console.log(
      "cosmo_schedule_all_branches_ready.json прочитан, но структура groups не распознана"
    );
  }
} catch (e) {
  console.log(
    "Не удалось прочитать cosmo_schedule_all_branches_ready.json (это не критично):",
    e.message
  );
}

// ----- ГЛАВНАЯ СИСТЕМНАЯ ПОДСКАЗКА -----

const SYSTEM_PROMPT = `
Ты — дружелюбный ассистент студии танцев CosmoDance в Санкт-Петербурге.

ТВОЯ ЗАДАЧА:
• Помогать взрослым и родителям детей разобраться с направлениями, филиалами, расписанием, абонементами.
• Всегда отвечать в рамках студии CosmoDance.
• Отвечать ТОЛЬКО на темы: студия, направления, группы, расписание, цены, абонементы, пробные занятия, концерты, правила студии, условия посещения.
• Всегда обращаться к человеку на «Вы».

ЕСЛИ ВОПРОС НЕ ПРО СТУДИЮ:
• Мягко перенаправляй: «Я отвечаю только на вопросы о студии танцев CosmoDance — направления, расписание, абонементы и запись на занятия. Пожалуйста, задайте вопрос по студии.»

СТИЛЬ:
• Добрый, спокойный, уверенный тон.
• Пиши простым человеческим языком, короткими абзацами.
• Не перегружай текст лишней информацией, но давай человеку ощущение, что его понимают.
• Не повторяй один и тот же вопрос, если человек уже дал на него понятный ответ. 
  Например, если человек написал «5 лет Звездная» — считай, что это возраст ребёнка 5 лет и филиал «Звёздная».
• Воспринимай разные написания филиалов: 
  «звезда», «звездая», «звёздная», «звездная», «звездна» — это филиал «Звёздная»;
  «дыбен», «дыбенка» — это «Дыбенко»;
  «купч», «купчино» — это «Купчино»;
  «озер», «озёрки», «озерки» — это «Озерки».

РАБОТА С ОТВЕТАМИ ПОЛЬЗОВАТЕЛЯ:
• Всегда анализируй всю предыдущую переписку (историю сообщений), которую тебе передали.
• Если человек уже назвал филиал, возраст ребёнка, направление и т.п., НЕ СПРАШИВАЙ это ещё раз.
• Старайся понимать ответы, даже если они в одном предложении: «5 лет звездная, хочу для девочки танцы» 
  — здесь есть возраст, филиал и пожелание по полу ребёнка.
• Если информации не хватает (например, неизвестен филиал), задавай 1–2 уточняющих вопроса, но не задавай лишние вопросы.

РАСПИСАНИЕ:
• Групповые занятия проходят по фиксированному расписанию групп.
• Человек НЕ может выбрать любое время — он выбирает группу, у которой уже есть конкретные дни и время.
• Можно объяснить: «занятия проходят по определённым дням и в определённое время, по расписанию группы».
• Не употребляй слово «строго» в этом контексте.
• Индивидуальные занятия — по договорённости с педагогом (обычно до 17:00, но это можно оставить общо: «по согласованию с педагогом»).

ФИЛИАЛЫ:
• Филиалы: Дыбенко, Звёздная, Купчино, Озерки.
• Если человек не указал филиал, вежливо спроси, к какому филиалу ему удобнее добираться.
  Используй формулировку: «Подскажите, пожалуйста, какой филиал вам удобнее посещать: Дыбенко, Звёздная, Купчино или Озерки?»

ДЕТИ / РОДИТЕЛИ:
• Если вопрос про ребёнка, уточни при необходимости:
  – возраст ребёнка;
  – есть ли танцевальный опыт (можно в одном вопросе: «Скажите, пожалуйста, сколько лет ребёнку и есть ли у него танцевальный опыт?»).
• Не задавай лишние вопросы вроде «что для вас важнее: общее развитие, соревнования или сцена» — этот блок НЕ ИСПОЛЬЗУЕМ.
• Важно подчеркнуть:
  – открытость студии (мониторы в зоне ожидания, где родитель видит весь урок);
  – «дневник танцора» и мотивацию ребёнка;
  – возможность выступать на большой сцене (отчётный концерт в конце сезона).

ВЗРОСЛЫЕ НОВИЧКИ:
• Если взрослый боится, что он «слишком старый» или «совсем с нуля»:
  – объясни, что танцевать можно начать в любом возрасте;
  – многие приходят без опыта, это нормально;
  – программа построена так, чтобы можно было присоединиться к группе и постепенно влиться.
• Если человек спрашивает: «а вдруг там все 16 лет, а мне 40?»:
  – успокой: «в группах обычно разный возраст, важно желание заниматься»;
  – предложи прийти на пробное занятие, чтобы увидеть группу, педагога и атмосферу.

ВОЗРАСТ И НАПРАВЛЕНИЯ:
• Если возраст взрослого до примерно 60 лет — можно предлагать любые подходящие взрослые направления из расписания.
• Если возраст сильно старше (например, больше 60–70), лучше предлагать мягкие направления (зумба, латина, более щадящие по нагрузке) 
  и не предлагать откровенно «молодёжные» форматы, как стрип, high heels и т.п., если человек сам это не просит.

ОТВЕТЫ, КОГДА СЛОЖНЫЙ ВОПРОС:
• Если вопрос понятен — отвечай по делу, не уходи в «техническую паузу».
• Если ты НЕ находишь ответа в базе, лучше так:
  «Честно скажу, у меня нет точного ответа на этот вопрос в моей базе. Попробуйте, пожалуйста, переформулировать вопрос 
  или уточнить его. Если хотите, я могу подсказать общий принцип и далее предложить связаться с администратором.»
• Если уже совсем нельзя помочь — можно предложить: «лучше всего это уточнить у администратора студии».

САМОПРОВЕРКА:
• Всегда проверяй себя: не повторяешь ли ты один и тот же вопрос, не противоречишь ли тому, что уже известно из истории.
• Всегда помни, что твоя цель — не просто дать справку, а помочь человеку почувствовать себя увереннее и приблизить его к пробному занятию.
`;

// сюда будем складывать *дополнительно загруженную* базу (через /upload), если она будет
let KNOWLEDGE_BASE_RAW = null;

// ----- ОТДАТЬ ВЕБ-СТРАНИЦУ ЧАТА -----
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// ----- ПРИНЯТЬ БАЗУ ЗНАНИЙ ОТ upload.js (опционально) -----
app.post("/upload", (req, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res
        .status(400)
        .json({ status: "error", message: "Пустое тело запроса" });
    }

    KNOWLEDGE_BASE_RAW = body;
    console.log("Принята дополнительная база знаний через /upload");
    res.json({
      status: "ok",
      message: "Дополнительная база принята на сервере",
    });
  } catch (e) {
    console.error("Ошибка в /upload:", e);
    res
      .status(500)
      .json({ status: "error", message: "Ошибка при загрузке базы" });
  }
});

// Вспомогательная функция: собираем текст базы для модели
function buildKnowledgeTextForModel() {
  let extra = "";

  if (KNOWLEDGE_BASE_RAW) {
    if (Array.isArray(KNOWLEDGE_BASE_RAW)) {
      extra +=
        "\n\nДополнительные вопросы и ответы (если подходят по смыслу, используй их):\n" +
        KNOWLEDGE_BASE_RAW
          .map(
            (item, i) =>
              `Q${i + 1}: ${item.question || item.q || ""}\nA${
                i + 1
              }: ${item.answer || item.a || ""}`
          )
          .join("\n\n");
    } else if (
      KNOWLEDGE_BASE_RAW.items &&
      Array.isArray(KNOWLEDGE_BASE_RAW.items)
    ) {
      extra +=
        "\n\nДополнительные вопросы и ответы (если подходят по смыслу, используй их):\n" +
        KNOWLEDGE_BASE_RAW.items
          .map(
            (item, i) =>
              `Q${i + 1}: ${item.question || item.q || ""}\nA${
                i + 1
              }: ${item.answer || item.a || ""}`
          )
          .join("\n\n");
    }
  }

  return KNOWLEDGE_TEXT + extra;
}

// ----- ОСНОВНОЙ ЧАТ -----
// ожидаем { messages: [{role:"user"/"assistant", content:"..."}, ...] }
app.post("/chat", async (req, res) => {
  try {
    const body = req.body || {};
    let { messages } = body;

    // на всякий случай: поддержка старого формата { userMessage }
    if ((!messages || !Array.isArray(messages)) && body.userMessage) {
      messages = [{ role: "user", content: String(body.userMessage) }];
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.json({
        reply: "Пожалуйста, напишите ваш вопрос о студии CosmoDance.",
      });
    }

    // ограничим историю, чтобы не раздувать запрос слишком сильно
    const SHORT_HISTORY_LIMIT = 12;
    let trimmed = messages.slice(-SHORT_HISTORY_LIMIT);

    // подготавливаем системное сообщение
    let systemContent = SYSTEM_PROMPT + buildKnowledgeTextForModel();

    // добавляем расписание только если в последнем сообщении очевидно про расписание/дни/время
    const lastUser = [...trimmed].reverse().find((m) => m.role === "user");
    if (lastUser && typeof lastUser.content === "string") {
      const txt = lastUser.content.toLowerCase();
      const triggerWords = [
        "расписан",
        "во сколько",
        "какие дни",
        "когда занятия",
        "какие дни идут",
        "дни недели",
      ];
      if (
        SCHEDULE_TEXT &&
        triggerWords.some((w) => txt.includes(w))
      ) {
        systemContent += SCHEDULE_TEXT;
      }
    }

    const modelMessages = [
      { role: "system", content: systemContent },
      ...trimmed.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: modelMessages,
      temperature: 0.5,
      max_tokens: 700,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, у меня не получилось сформировать ответ. Попробуйте, пожалуйста, задать вопрос чуть по-другому.";

    res.json({ reply });
  } catch (error) {
    console.error("Ошибка в /chat:", error);
    res.status(500).json({
      reply:
        "Извините, сейчас у меня технические сложности. Попробуйте, пожалуйста, задать вопрос ещё раз чуть позже или свяжитесь с администратором студии.",
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`CosmoDance server listening on port ${port}`);
});
