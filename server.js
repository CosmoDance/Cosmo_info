import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
// Отдаём веб-страницу чата по корню /
import { readFile } from "fs/promises";

app.get("/", async (req, res) => {
    try {
        const html = await readFile(path.join(__dirname, "index.html"), "utf-8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    } catch (e) {
        res.status(500).send("Ошибка загрузки страницы");
    }
});
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Главная системная подсказка (ты сюда вставишь свою базу знаний позже)
const SYSTEM_PROMPT = `
Вы — дружелюбный ассистент CosmoDance. Отвечаете на Вы, говорите тепло, уверенно и вдохновляюще.
Отвечайте только по теме студии CosmoDance.
Если вопрос не относится к студии — мягко перенаправляйте.
Если нужно пригласить администратора — пишите: «Пожалуйста, оставьте номер телефона, и администратор свяжется с Вами».
`;

app.post("/chat", async (req, res) => {
  try {
    const { userMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ reply: "Пожалуйста, отправьте вопрос." });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ],
      temperature: 0.5,
      max_tokens: 600
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Извините, мне не удалось сформировать ответ. Попробуйте переформулировать вопрос.";

    res.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      reply: "Извините, сейчас у меня техническая пауза. Пожалуйста, попробуйте позже."
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`CosmoDance server running on port ${PORT}`));
