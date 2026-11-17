
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
// 2. NEURO'S BRAIN AND INSTRUCTIONS
// ==========================================

const SYSTEM_PROMPT = `
You are Neuro, a long-term personal AI assistant.

You are helping the user using this personal profile:

${JSON.stringify(PROFILE_FOR_AI, null, 2)}

YOUR MAIN RESPONSIBILITIES:

EDUCATION:
- Support the user through Senior Three and Senior Four.
- Prepare the user for Senior Five and Senior Six.
- Teach Mathematics, English, Biology, Physics, Chemistry,
  Geography, History and Political Education, and Entrepreneurship.
- Explain difficult subjects in simple steps.
- Help with assignments, revision and examinations.
- Create realistic study plans and timetables.

A-LEVEL:
- The user's A-Level combination has not yet been selected.
- Ask the user about the combination after Senior Four.
- Never guess or choose the combination for the user.
- Adapt future lessons to the confirmed combination.

UNIVERSITY:
- The user's ambition is to study Information Technology
  at Brigham Young University (BYU).
- Help prepare for university admission.
- Research scholarships and eligibility requirements.
- Verify current university information before giving advice.
- The user hopes to pursue BYU studies alongside Senior Five
  and Senior Six. Treat this as a plan, not confirmed enrollment.
- Help identify admission, timetable and workload challenges.

TECHNOLOGY:
- Teach JavaScript, Node.js and programming.
- Help with web development and software projects.
- Explain errors and help debug code.
- Support the development of Neuro itself.
- Introduce artificial intelligence and computer science concepts.

RESEARCH:
- Help investigate academic and practical topics.
- Use reliable sources when research tools are available.
- Provide accurate references.
- Never invent facts or citations.
- Clearly distinguish facts from assumptions.

PRODUCTIVITY:
- Help organise assignments, projects and deadlines.
- Create schedules and reminders when supported.
- Help prepare documents and academic reports.
- Track progress when persistent storage is available.

PRIVACY AND APPROVAL:
- Never request passwords, API keys or verification codes.
- Protect the user's personal information.
- Never send emails without explicit approval.
- Never submit assignments without explicit approval.
- Never claim to have completed an action that you have not performed.

COMMUNICATION:
- Use clear, understandable English.
- Give practical, step-by-step instructions.
- Avoid unnecessary repetition.
- Adapt explanations to the user's current education level.
- Be patient when teaching technical subjects.

LONG-TERM PURPOSE:

Grow alongside the user from secondary school through
university and professional development.

You are Neuro. Help the user learn, build, research,
organise and achieve long-term goals.
`;

// ==========================================
// 3. CONVERSATION HISTORY
// ==========================================

const history = [];

// ==========================================
// 4. CONNECT NEURO TO GEMINI AI
// ==========================================

async function askGemini(message) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is not configured in Render.");
  }

  history.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: history.slice(-16),
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error("========== GEMINI API ERROR ==========");
      console.error("HTTP STATUS:", response.status);
      console.error("GOOGLE RESPONSE:", responseText);
      console.error("======================================");

      let errorMessage = responseText;

      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || responseText;
      } catch {
        // Keep the original response.
      }

      throw new Error(
        "Gemini request failed (" +
        response.status +
        "): " +
        errorMessage
      );
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned no text:", JSON.stringify(data));
      throw new Error("Gemini returned an empty response.");
    }

    history.push({
      role: "model",
      parts: [{ text: reply }]
    });

    return reply;

  } catch (error) {
    history.pop();
    console.error("Neuro Gemini error:", error.message);
    throw error;
  }
}

// ==========================================
// 5. NEURO'S CHAT INTERFACE
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
      font-family: Arial, sans-serif;
      background: #0f1115;
      color: #eee;
      margin: 0;
    }

    #app {
      max-width: 750px;
      margin: 0 auto;
      padding: 18px;
    }

    h1 {
      margin: 8px 0;
      color: #a5b4fc;
    }

    .subtitle {
      color: #999;
      font-size: 14px;
    }

    #buttons {
      margin-top: 18px;
    }

    #buttons button {
      margin: 4px 4px 4px 0;
    }

    #chat {
      height: 55vh;
      overflow-y: auto;
      background: #181b22;
      border-radius: 10px;
      padding: 14px;
      margin: 16px 0;
    }

    .me {
      color: #7dd3fc;
      margin: 12px 0;
      white-space: pre-wrap;
    }

    .bot {
      color: #eee;
      margin: 12px 0;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    #row {
      display: flex;
      gap: 8px;
    }

    #msg {
      flex: 1;
      min-width: 0;
      padding: 12px;
      border-radius: 7px;
      border: none;
      background: #fff;
      color: #111;
    }

    button {
      padding: 11px 15px;
      border-radius: 7px;
      border: none;
      background: #4f46e5;
      color: white;
      cursor: pointer;
    }

    button:hover {
      background: #6366f1;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    footer {
      color: #777;
      font-size: 12px;
      text-align: center;
      margin-top: 20px;
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
      <button onclick="quick('Make me a study plan for this week across all my subjects.')">
        Study plan
      </button>

      <button onclick="quick('Give me safe ways to learn skills and earn money with computers in Uganda.')">
        Opportunities
      </button>

      <button onclick="quick('What should I do today?')">
        What should I do today?
      </button>
    </div>

    <div id="chat">
      <div class="bot">
        Neuro: Hello! I'm Neuro. What would you like us to work on today?
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
        waiting.textContent =
          "Neuro: Sorry, something went wrong. Please check the server logs.";

        console.error(error);

      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    }

    function send() {
      const text = input.value.trim();

      if (!text) return;

      input.value = "";
      ask(text);
    }

    function quick(text) {
      ask(text);
    }
  </script>

</body>
</html>`;

// ==========================================
// 6. CREATE NEURO'S SERVER
// ==========================================

const server = http.createServer(async (req, res) => {

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

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 10000) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");

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
        console.error("Neuro error:", error.message);

        res.writeHead(500);

        res.end(JSON.stringify({
          error: "Neuro could not process your request. Please try again."
        }));
      }
    });

    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(PAGE);
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
