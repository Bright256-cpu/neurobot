import http from "http";

const SYSTEM_PROMPT = `You are Neurobot, a friendly coach for a Ugandan student who is in Senior Three and going into Senior Four. Subjects: English, Mathematics, Biology, Physics, Chemistry, Geography, History and Political Education, and Entrepreneurship, following Uganda's competence-based lower secondary curriculum. The student loves computers and is learning to code. Give clear, practical, step-by-step advice. For study help, make short daily or weekly plans and explain topics simply. For money ideas, only suggest safe, legal things suitable for a minor, such as learning skills, school competitions, small tech help for local businesses with a parent's knowledge, and entrepreneurship projects. Never ask for personal details, passwords, or payments. If you are unsure about a fact, say so. Keep answers short and use simple English.`;

const history = [];

async function askGemini(message) {
  history.push({ role: "user", parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history.slice(-16),
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
      })
    }
  );

  if (!response.ok) {
    history.pop();
    throw new Error("AI request failed: " + response.status);
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    history.pop();
    throw new Error("Empty AI response");
  }

  history.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

const PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Neurobot</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f1115; color: #eee; margin: 0; }
    #app { max-width: 700px; margin: 0 auto; padding: 16px; }
    h1 { margin: 8px 0; }
    #buttons button { margin: 4px 4px 4px 0; }
    #chat { height: 55vh; overflow-y: auto; background: #181b22; border-radius: 8px; padding: 12px; margin: 12px 0; }
    .me { color: #7dd3fc; margin: 8px 0; }
    .bot { color: #eee; margin: 8px 0; white-space: pre-wrap; }
    #row { display: flex; gap: 8px; }
    #msg { flex: 1; padding: 10px; border-radius: 6px; border: none; }
    button { padding: 10px 14px; border-radius: 6px; border: none; background: #4f46e5; color: white; cursor: pointer; }
  </style>
</head>
<body>
  <div id="app">
    <h1>Neurobot</h1>
    <div id="buttons">
      <button onclick="quick('Make me a study plan for this week across all my subjects.')">Study plan</button>
      <button onclick="quick('Give me safe ways to learn skills and earn money with computers in Uganda.')">Opportunities</button>
      <button onclick="quick('What should I do today?')">What should I do today?</button>
    </div>
    <div id="chat"></div>
    <div id="row">
      <input id="msg" placeholder="Ask Neurobot anything..." onkeydown="if(event.key==='Enter') send()">
      <button onclick="send()">Send</button>
    </div>
  </div>
  <script>
    const chat = document.getElementById("chat");
    const input = document.getElementById("msg");

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
      const waiting = add("bot", "Neurobot is thinking...");
      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        waiting.textContent = "Neurobot: " + (data.reply || data.error);
      } catch (e) {
        waiting.textContent = "Neurobot: something went wrong, please try again.";
      }
    }

    function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      ask(text);
    }

    function quick(text) { ask(text); }
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");
      try {
        const { message } = JSON.parse(body || "{}");
        if (!message) throw new Error("No message");
        const reply = await askGemini(message);
        res.end(JSON.stringify({ reply }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(PAGE);
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Neurobot is running");
});
