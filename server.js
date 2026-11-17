
import http from "http";
import { USER_PROFILE } from "./profile.js";

// ==========================================
// 1. NEURO'S PERSONAL PROFILE
// ==========================================

const {
  dateOfBirth,
  ...safeIdentity
} = USER_PROFILE.identity || {};

const PROFILE_FOR_AI = {
  ...USER_PROFILE,
  identity: safeIdentity
};

// ==========================================
// 2. NEURO'S SYSTEM INSTRUCTIONS
// ==========================================

const SYSTEM_PROMPT = `
You are Neuro, Bright's personal AI assistant.

USER PROFILE:
${JSON.stringify(PROFILE_FOR_AI, null, 2)}

YOUR RESPONSIBILITIES:

EDUCATION:
- Help Bright with Senior Three and Senior Four.
- Teach all his listed school subjects.
- Explain difficult concepts step by step.
- Prepare revision notes, quizzes and study plans.
- Support his academic progress.

A-LEVEL:
- Never guess Bright's A-Level combination.
- Ask him after Senior Four.
- Adapt lessons to his confirmed combination.

UNIVERSITY:
- Help Bright prepare for Brigham Young University (BYU).
- His intended course is Information Technology.
- Research admission requirements and scholarships.
- Verify current information before making claims.
- His plan to study alongside A-Level is not confirmed enrollment.

TECHNOLOGY:
- Teach JavaScript, Node.js and programming.
- Help build websites and software.
- Explain errors and debugging.
- Teach artificial intelligence and computer science.
- Help develop Neuro.

RESEARCH:
- Use reliable sources when available.
- Never invent facts or citations.
- Separate verified facts from assumptions.

PRODUCTIVITY:
- Help manage assignments and deadlines.
- Create study schedules.
- Help prepare academic documents.
- Track progress when storage is available.

PRIVACY:
- Never request passwords or API keys.
- Never expose private information.
- Never send emails without permission.
- Never submit assignments without permission.

COMMUNICATION:
- Use clear English.
- Be patient.
- Give practical examples.
- Explain things step by step.
- Teach Bright at his current academic level.

LONG-TERM PURPOSE:
Help Bright grow through secondary school, university
and professional development.

You are Neuro. Help Bright learn, build, research,
organise and achieve his goals.
`;

// ==========================================
// 3. CONVERSATION MEMORY
// ==========================================

const history = [];

// ==========================================
// 4. GEMINI CONNECTION
// ==========================================

async function askGemini(message) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing from Render Environment."
    );
  }

  const conversation = [
    ...history.slice(-14),
    {
      role: "user",
      parts: [{ text: message }]
    }
  ];

  let response;

  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: conversation,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      }
    );
  } catch (error) {
    throw new Error(
      "Could not connect to Google: " + error.message
    );
  }

  const rawResponse = await response.text();

  let data;

  try {
    data = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      "Google returned an invalid response: " +
      rawResponse.slice(0, 500)
    );
  }

  // SHOW GOOGLE'S ACTUAL ERROR

  if (!response.ok) {
    const googleMessage =
      data.error?.message || "Unknown Google API error";

    const googleStatus =
      data.error?.status || "UNKNOWN";

    console.error("GOOGLE API ERROR:", {
      httpStatus: response.status,
      status: googleStatus,
      message: googleMessage
    });

    throw new Error(
      `Google API ${response.status} (${googleStatus}): ${googleMessage}`
    );
  }

  // CHECK THE AI RESPONSE

  const candidate = data.candidates?.[0];

  if (!candidate) {
    throw new Error(
      "Google returned no AI response. Check the API response."
    );
  }

  const reply = candidate.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new Error(
      "Google returned no text. Finish reason: " +
      (candidate.finishReason || "Unknown")
    );
  }

  // SAVE SUCCESSFUL CONVERSATION

  history.push(
    { role: "user", parts: [{ text: message }] },
    { role: "model", parts: [{ text: reply }] }
  );

  while (history.length > 20) {
    history.shift();
  }

  return reply;
}

// ==========================================
// 5. NEURO'S WEB INTERFACE
// ==========================================

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Neuro AI Assistant</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #0f1115;
  color: white;
  font-family: Arial, sans-serif;
}

#app {
  max-width: 750px;
  margin: auto;
  padding: 18px;
}

h1 {
  color: #a5b4fc;
}

.subtitle {
  color: #999;
}

#buttons {
  margin: 20px 0;
}

button {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 12px 16px;
  margin: 4px;
  border-radius: 7px;
  cursor: pointer;
}

button:hover {
  background: #6366f1;
}

button:disabled {
  opacity: 0.5;
}

#chat {
  height: 55vh;
  overflow-y: auto;
  background: #181b22;
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
}

.me {
  color: #7dd3fc;
  margin: 14px 0;
  white-space: pre-wrap;
}

.bot {
  color: white;
  margin: 14px 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.error {
  color: #fca5a5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

#row {
  display: flex;
  gap: 8px;
}

#msg {
  flex: 1;
  min-width: 0;
  padding: 13px;
  border-radius: 7px;
  border: none;
}

footer {
  text-align: center;
  color: #777;
  margin-top: 25px;
  font-size: 12px;
}
</style>
</head>

<body>

<div id="app">

<h1>Neuro</h1>

<div class="subtitle">
Your personal AI assistant
</div>

<div id="buttons">

<button onclick="quick('Make me a study plan for this week.')">
Study plan
</button>

<button onclick="quick('Give me safe technology opportunities in Uganda.')">
Opportunities
</button>

<button onclick="quick('What should I do today?')">
What should I do today?
</button>

</div>

<div id="chat">
<div class="bot">
Neuro: Hello Bright! I'm ready to help you learn, build and achieve your goals.
</div>
</div>

<div id="row">

<input
id="msg"
type="text"
placeholder="Ask Neuro anything..."
onkeydown="if(event.key === 'Enter') send()"
>

<button id="sendBtn" onclick="send()">
Send
</button>

</div>

<footer>
Neuro AI Assistant
</footer>

</div>

<script>

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("sendBtn");

function add(cls, text) {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

async function ask(text) {

  add("me", "You: " + text);

  const waiting = add("bot", "Neuro: Thinking...");

  sendBtn.disabled = true;

  try {

    const res = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    waiting.textContent = "Neuro: " + data.reply;

  } catch (error) {

    waiting.className = "error";

    waiting.textContent =
      "Neuro error: " + error.message;

    console.error(error);

  } finally {

    sendBtn.disabled = false;
    input.focus();

  }
}

function send() {
  const text = input.value.trim();

  if (!text || sendBtn.disabled) return;

  input.value = "";
  ask(text);
}

function quick(text) {
  if (!sendBtn.disabled) ask(text);
}

</script>

</body>
</html>`;

// ==========================================
// 6. CREATE SERVER
// ==========================================

const server = http.createServer((req, res) => {

  if (req.method === "GET" && req.url === "/health") {

    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
      status: "online",
      assistant: "Neuro"
    }));

    return;
  }

  if (req.method === "GET" && req.url === "/") {

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(PAGE);

    return;
  }

  if (req.method === "POST" && req.url === "/chat") {

    let body = "";
    let tooLarge = false;

    req.on("data", chunk => {

      body += chunk;

      if (body.length > 10000) {
        tooLarge = true;
      }

    });

    req.on("end", async () => {

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      if (tooLarge) {

        res.writeHead(413);

        res.end(JSON.stringify({
          error: "Message is too large."
        }));

        return;
      }

      try {

        const { message } = JSON.parse(body || "{}");

        if (
          typeof message !== "string" ||
          !message.trim()
        ) {

          res.writeHead(400);

          res.end(JSON.stringify({
            error: "Please enter a valid message."
          }));

          return;
        }

        const reply = await askGemini(message.trim());

        res.writeHead(200);

        res.end(JSON.stringify({
          reply
        }));

      } catch (error) {

        console.error("NEURO ERROR:", error.message);

        res.writeHead(500);

        res.end(JSON.stringify({
          error: error.message
        }));

      }

    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify({
    error: "Page not found."
  }));

});

// ==========================================
// 7. START NEURO
// ==========================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Neuro is running on port " + PORT);
});
