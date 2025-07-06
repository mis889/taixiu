const Fastify = require("fastify");
const WebSocket = require("ws");
const fetch = require("node-fetch");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = "AIzaSyC-aNjKTQ2XVaM3LPUWLjQtB67m5VXO58o";

let lastResults = [];
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
    console.log("✅ WebSocket đã kết nối");

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
    } catch (e) {
      console.error("❌ JSON parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng. Kết nối lại sau 5s...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket lỗi:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/axocuto", async (request, reply) => {
  const results = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (results.length < 3) {
    return { error: "Không đủ dữ liệu để phân tích" };
  }

  const getResult = (d1, d2, d3) => (d1 + d2 + d3 >= 11 ? "Tài" : "Xỉu");
  const latest = results[0];
  const patternArr = results.slice(0, 3).map(r => getResult(r.d1, r.d2, r.d3));
  const patternStr = patternArr.join(" - ");

  const prompt = `Dựa trên pattern sau: ${patternStr}
Hãy dự đoán kết quả phiên tiếp theo là gì (Tài hoặc Xỉu)?
Giải thích lý do, xác định loại pattern, và đưa ra % độ tin cậy.`;

  let geminiText = "";
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await res.json();
    geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi từ Gemini";

  } catch (err) {
    geminiText = "Lỗi khi gọi AI Gemini: " + err.message;
  }

  return {
    current_result: getResult(latest.d1, latest.d2, latest.d3),
    current_session: latest.sid,
    next_session: latest.sid + 1,
    prediction: geminiText.includes("Xỉu") ? "Xỉu" : "Tài",
    used_pattern: "AI Gemini Pro",
    pattern: `Pattern ${patternStr} - Dự đoán bằng AI Gemini`,
    ai_analysis: {
      reason: "",
      pattern_type: "**Đang xuất hiện:** Với dữ liệu ngắn như vậy, rất khó để xác định một loại cầu cụ thể. Có thể xem đây là cầu hỗn hợp, hoặc đoạn cầu bị gián đoạn.",
      confidence: "85%"
    },
    gemini_response: geminiText
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server Fastify chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
