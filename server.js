const Fastify = require("fastify");
const WebSocket = require("ws");

let fetch = global.fetch;
if (!fetch) fetch = require("node-fetch");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = "AIzaSyCNmonlpE6yLsY_olGUPfN1K-dvQQuQmkw";

let lastResults = [];
let currentResult = null;
let currentSession = null;

let ws = null;
let reconnectInterval = 5000;
let intervalCmd = null;

// Gửi lệnh để nhận kết quả
function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

// Kết nối WebSocket
function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjB9.p56b5g73I9wyoVu4db679bOvVeFJWVjGDg_ulBXyav8");

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket");

    const authPayload = [
      1,
      "MiniGame",
      "SC_xigtupou",
      "conga999",
      {
        info: JSON.stringify({
          ipAddress: "2a09:bac5:d46e:25b9::3c2:39",
          userId: "eff718a2-31db-4dd5-acb5-41f8cfd3e486",
          username: "SC_miss88",
          timestamp: Date.now(),
          refreshToken: "22aadcb93490422b8d713f8776329a48.9adf6a5293d8443a888edd3ee802b9f4"
        }),
        signature: "06FBBB7B38F79CBFCD34485EEEDF4104E542C26114984D0E9155073FD73E4C23CDCF1029B8F75B26427D641D5FE7BC4B231ABB0D2F6EBC76ED6EDE56B640ED161DEA92A6340AD911AD3D029D8A39E081EB9463BCA194C6B7230C89858723A9E3599868CAEC4D475C22266E4B299BA832D9E20BC3374679CA4F880593CF5D5845"
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
        const latest = lastResults[0];
        const total = latest.d1 + latest.d2 + latest.d3;
        currentResult = total >= 11 ? "Tài" : "Xỉu";
        currentSession = latest.sid;
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.warn("❌ WebSocket bị đóng, đang kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

// Gọi Gemini phân tích và dự đoán
async function getPredictionFromGemini(pattern) {
  const prompt = `
Dãy kết quả Tài Xỉu gần đây là: ${pattern.replace(/T/g, "Tài").replace(/X/g, "Xỉu")}.
Bạn là chuyên gia AI thống kê. Hãy trả lời JSON theo mẫu:

{
  "prediction": "Tài hoặc Xỉu",
  "reason": "Lý do ngắn gọn",
  "pattern_type": "Tên mẫu nếu có",
  "confidence": "Mức độ tin tưởng (%)",
  "gemini_response": "Phân tích chi tiết"
}
`.trim();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[^]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        prediction: parsed.prediction?.includes("Tài") ? "Tài" :
                   parsed.prediction?.includes("Xỉu") ? "Xỉu" : "Chờ",
        pattern_type: parsed.pattern_type || "Không rõ",
        ai_analysis: {
          reason: parsed.reason || "",
          confidence: parsed.confidence || "",
        },
        gemini_response: parsed.gemini_response || text
      };
    }
    return { prediction: "Chờ", pattern_type: "", ai_analysis: {}, gemini_response: text };
  } catch (e) {
    return { prediction: "Chờ", pattern_type: "", ai_analysis: {}, gemini_response: e.message };
  }
}

// API endpoint
fastify.get("/api/taixiu", async (request, reply) => {
  const valid = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (valid.length < 6) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: "Chờ",
      used_pattern: "",
      pattern_type: "",
      ai_analysis: {},
      gemini_response: ""
    };
  }

  const current = valid[0];
  const currentSession = current.sid;
  const nextSession = current.sid + 1;

  const usedPattern = valid
    .slice(0, 6)
    .map(r => (r.d1 + r.d2 + r.d3 >= 11 ? "T" : "X"))
    .reverse()
    .join("");

  const {
    prediction,
    pattern_type,
    ai_analysis,
    gemini_response
  } = await getPredictionFromGemini(usedPattern);

  return {
    current_result: (current.d1 + current.d2 + current.d3 >= 11) ? "Tài" : "Xỉu",
    current_session: currentSession,
    next_session: nextSession,
    prediction,
    used_pattern: usedPattern,
    pattern_type,
    ai_analysis,
    gemini_response
  };
});

// Start server
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server chạy tại ${address}`);
});
