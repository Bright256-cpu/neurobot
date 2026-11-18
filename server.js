
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
const MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite"
];

const RETRY_STATUSES = [429, 500, 503, 504];
const MAX_ATTEMPTS = 3;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function callModel(model, apiKey, conversation) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey.trim()
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: conversation,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
          })
        }
      );
    } catch (error) {
      lastError = new Error("Could not connect to Gemini: " + error.message);
      if (attempt < MAX_ATTEMPTS) await sleep(attempt * 1000);
      continue;
    }

    const rawResponse = await response.text();
    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch {
      lastError = new Error(
        "Google returned an invalid response: " + rawResponse.slice(0, 500)
      );
      if (attempt < MAX_ATTEMPTS) await sleep(attempt * 1000);
      continue;
    }

    if (!response.ok) {
      const googleMessage = data.error?.message || "Unknown Google API error";
      const googleStatus = data.error?.status || "UNKNOWN";

      console.error("GEMINI API ERROR:", {
        model,
        attempt,
        httpStatus: response.status,
        status: googleStatus,
        message: googleMessage
      });

      lastError = new Error(
        `Google API ${response.status} (${googleStatus}): ${googleMessage}`
      );
      lastError.status = response.status;

      // Temporary problem: wait and try the same model again
      if (RETRY_STATUSES.includes(response.status) && attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 1500);
        continue;
      }

      // Anything else (or retries used up): give up on this model
      throw lastError;
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error("Gemini returned no AI response.");
    }

    const reply = candidate.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      throw new Error(
        "Gemini returned no text. Finish reason: " +
          (candidate.finishReason || "Unknown")
      );
    }

    return reply;
  }

  throw lastError;
}

async function askGemini(message) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing API key. Add GEMINI_API_KEY or GOOGLE_API_KEY in Render Environment."
    );
  }

  const conversation = [
    ...history.slice(-14),
    { role: "user", parts: [{ text: message }] }
  ];

  let reply;
  let lastError;

  for (const model of MODELS) {
    try {
      reply = await callModel(model, apiKey, conversation);
      break;
    } catch (error) {
      lastError = error;
      console.error(`Model ${model} failed, trying next if available.`);
    }
  }

  if (!reply) {
    throw lastError || new Error("All Gemini models failed.");
  }

  history.push(
    { role: "user", parts: [{ text: message }] },
    { role: "model", parts: [{ text: reply }] }
  );

  while (history.length > 20) {
    history.shift();
  }

  return reply;
}
