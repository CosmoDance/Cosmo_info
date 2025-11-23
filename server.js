import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import fs from "fs";

dotenv.config();

// ---------------- DIR ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- API CLIENT ----------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- SERVER ----------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ----------------------------------
// ======== Память сессий =========
// ----------------------------------
/**
 * ВОТ ЭТО ИСПРАВЛЯЕТ ЗАЦИКЛИВАНИЕ.
 * У каждой беседы свой CONTEXT
 */
const SESSIONS = {};
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 минут

function getSession(id) {
  if (!SESSIONS[id]) {
    SESSIONS[id] = { history: [], last: Date.now() };
  }
  return SESSIONS[id];
}

function clearOldSessions() {
  const now = Date.now();
  for (const id in SESSIONS) {
    if (now - SESSIONS[id].last > SESSION_TIMEOUT) {
      delete SESSIONS[id];
    }
  }
}
setInterval(clearOldSessions, 60 * 1000);

// ---------------- БАЗА ----------------
let KNOWLEDGE = null;

app.post("/upload", (req, res) => {
  KNOWLEDGE = req.body;
  console.log("База обновлена", Array.isArray(KNOWLEDGE) ? KNOWLEDGE.length : 0);
  res.json({ status: "ok" });
});

// ----------------------------------
// ========= ЧАТ ====================
// ----------------------------------
app.post("/chat", async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId) return res.status(400).json({ reply: "userId обязателен" });
    if (!message) return res.status(400).json({ reply: "Пустое сообщение" });

    const session = getSession(userId);
    session.last = Date.now();

    let context = "";

    if (KNOWLEDGE) {
      context = "Это база студии CosmoDance. Используй её как истину:\n";
      KNOWLEDGE.groups?.forEach((g, i) => {
        context += `#${i + 1} ${g.branch} — ${g.group_name} — ${g.schedule ? JSON.stringify(g.schedule) : ""}\n`;
      });
    }

    session.history.push({ role: "user", content: message });

    const completion = await client.responses.create({
      model: "gpt-5.1", // ← ВАЖНО!!!
      input: [
        {
          role: "system",
          content: `
Ты — ассистент студии CosmoDance.
Отвечай как живой человек.
Ты обязан учитывать контекст беседы.
Исправляй ошибки в тексте пользователя.
Запоминай возраст, филиал, направление.
Никогда не задавай один и тот же вопрос дважды.
Если информация уже есть — используй её.
Не предлагай администратора без причины.
Если группа: не спрашивай утро/вечер — дай расписание.
Если пользователь >60 — предлагай латино / зумба.
Если это детские — спрашивай возраст, не строго.
`
        },
        { role: "system", content: context },
        ...session.history,
      ],
    });

    const reply = completion.output_text.trim();
    session.history.push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Техническая пауза. Попробуйте ещё раз." });
  }
});

// ----------------------------------
// ========= САЙТ ====================
// ----------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("SERVER START", PORT));
