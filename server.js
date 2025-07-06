const Fastify = require("fastify");
const WebSocket = require("ws");
let fetch = global.fetch;
if (!fetch) fetch = require("node-fetch");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = "AIzaSyCNmonlpE6yLsY_olGUPfN1K-dvQQuQmkw";

let lastResults = [
  { sid: 1006, d1: 4, d2: 3, d3: 5 },
  { sid: 1005, d1: 2, d2: 2, d3: 4 },
  { sid: 1004, d1: 6, d2: 5, d3: 1 },
  { sid: 1003, d1: 3, d2: 2, d3: 4 },
  { sid: 1002, d1: 5, d2: 5, d3: 2 },
  { sid: 1001, d1: 2, d2: 2, d3: 3 }
];

let ws = null;
let reconnectInterval = 5000;
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
    console.log("📩 Dữ liệu nhận được:", data);
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
    } catch (e) {
      console.error("❌ Lỗi xử lý dữ liệu:", e.message);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket bị đóng, thử kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

async function getPredictionFromGemini(pattern) {
  const prompt = `Tôi cung cấp một chuỗi kết quả Tài Xỉu gồm 6 ván gần đây: ${pattern.replace(/T/g, "Tài").replace(/X/g, "Xỉu")}.
Bạn là AI chuyên phân tích chuỗi kết quả Tài Xỉu.
Hãy trả về JSON đúng chuẩn với định dạng sau:
{
  "prediction": "Tài hoặc Xỉu",
  "reason": "Ngắn gọn tại sao dự đoán vậy",
  "pattern_type": "Tên mẫu nếu nhận ra",
  "confidence": "Mức độ tự tin (%)",
  "gemini_response": "Toàn bộ phân tích"
}
Chỉ trả về JSON.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📩 Gemini raw response:", text);
    const jsonMatch = text.match(/\{[^]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        prediction: parsed.prediction?.includes("Tài") ? "Tài" : parsed.prediction?.includes("Xỉu") ? "Xỉu" : "Chờ",
        pattern_type: parsed.pattern_type || "Không rõ",
        ai_analysis: {
          reason: parsed.reason || "",
          confidence: parsed.confidence || ""
        },
        gemini_response: parsed.gemini_response || text
      };
    }
    return { prediction: "Chờ", pattern_type: "", ai_analysis: {}, gemini_response: text };
  } catch (e) {
    return { prediction: "Chờ", pattern_type: "", ai_analysis: {}, gemini_response: e.message };
  }
}

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
  const usedPattern = valid.slice(0, 6).map(r => (r.d1 + r.d2 + r.d3 >= 11 ? "T" : "X")).reverse().join("");

  const { prediction, pattern_type, ai_analysis, gemini_response } = await getPredictionFromGemini(usedPattern);

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

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server chạy tại ${address}`);
});

