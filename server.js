const Fastify = require("fastify");
const WebSocket = require("ws");
const fetch = require("node-fetch"); // Đảm bảo đã cài npm install node-fetch@2

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

// Dùng biến môi trường trong production
const GEMINI_API_KEY = "AIzaSyC-aNjKTQ2XVaM3LPUWLjQtB67m5VXO58o";

// Biến toàn cục
let lastResults = [];
let ws = null;
let intervalCmd = null;

function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjB9.p56b5g73I9wyoVu4db679bOvVeFJWVjGDg_ulBXyav8");

  ws.on("open", () => {
    const authPayload = [
      1,
      "MiniGame",
      "SC_xigtupou",
      "conga999",
      {
        info: "{\"ipAddress\":\"2001:ee0:4f91:2000:49ad:34c3:87af:91bd\",\"userId\":\"eff718a2-31db-4dd5-acb5-41f8cfd3e486\",\"username\":\"SC_miss88\",\"timestamp\":1751339136811,\"refreshToken\":\"22aadcb93490422b8d713f8776329a48.9adf6a5293d8443a888edd3ee802b9f4\"}",
        signature: "1CC2919566B000AA9A5D184382B983232798F1AE0D0684F2B60148B88ADEF951F43494503E97981EB96275E4597D93208029C516F77066242A5E549C902B21FF8AB326300FDCBE1876D2591AA4C8709C2C2CA59F058E92D666F5B6B2FD8A7DD9A7C519AE6EB3CBFA9D80432DECFE3A978C3DDBE77D9D0FB62E222E873A42F780"
      }
    ];
    ws.send(JSON.stringify(authPayload));
    clearInterval(intervalCmd);
    intervalCmd = setInterval(sendCmd1005, 5000);
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        lastResults = json[1].htr.map(item => ({
          sid: item.sid,
          d1: item.d1,
          d2: item.d2,
          d3: item.d3
        }));
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, 5000);
  });

  ws.on("error", () => ws.close());
}

connectWebSocket();

fastify.get("/api/axocuto", async (req, res) => {
  const results = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (results.length < 3) {
    return {
      prediction: "Không đủ dữ liệu",
      reason: "Cần ít nhất 3 phiên để phân tích"
    };
  }

  const getResult = (d1, d2, d3) => (d1 + d2 + d3 >= 11 ? "Tài" : "Xỉu");
  const patternArr = results.slice(0, 3).map(r => getResult(r.d1, r.d2, r.d3));
  const patternStr = patternArr.join(" - ");

  const prompt = `Bạn là chuyên gia phân tích game Tài Xỉu. Dựa vào chuỗi: "${patternStr}", hãy phân tích loại cầu, dự đoán kết quả tiếp theo và độ tin cậy. Trả lời đúng JSON:
{
  "prediction": "Tài",
  "reason": "Giải thích...",
  "pattern_type_identified": "Cầu 1-1",
  "confidence_percentage": 85
}`;

  try {
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const aiData = await aiRes.json();
    const raw = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      current_result: getResult(results[0].d1, results[0].d2, results[0].d3),
      current_session: results[0].sid,
      next_session: results[0].sid + 1,
      prediction: parsed.prediction,
      used_pattern: "AI Gemini",
      pattern: patternStr,
      ai_analysis: {
        reason: parsed.reason,
        pattern_type: parsed.pattern_type_identified,
        confidence: parsed.confidence_percentage + "%"
      },
      gemini_response: raw
    };

  } catch (err) {
    return {
      prediction: "Lỗi AI",
      reason: err.message
    };
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
  } catch (err) {
    console.error("❌ Lỗi khi khởi động server:", err);
    process.exit(1);
  }
};

start();
