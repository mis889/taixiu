const Fastify = require("fastify");
const WebSocket = require("ws");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

// Khởi tạo AI Gemini
const genAI = new GoogleGenerativeAI("AIzaSyC-aNjKTQ2XVaM3LPUWLjQtB67m5VXO58o");

let lastResults = [];
let currentResult = null;
let currentSession = null;

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
    console.log("Đã kết nối WebSocket");

    const authPayload = [
      1,
      "MiniGame",
      "SC_xigtupou",
      "conga999",
      {
        info: "{\"ipAddress\":\"171.246.10.199\",\"userId\":\"7c54ec3f-ee1a-428c-a56e-1bc14fd27e57\",\"username\":\"SC_xigtupou\",\"timestamp\":1748266471861,\"refreshToken\":\"ce8de19af18f4417bb68c3632408d4d7.479079475124482181468c8923b636af\"}",
        signature: "0EC9E9B2311CD352561D9556F88F6AB4167502EAC5F9767D07D43E521FE1BA056C7C67DF0491D20BCE9877B71373A2115CC61E9ED43B8AF1EF6EAC3757EA5B2A46BCB0C519EDCB46DB0EB9ACA445D7076CC1F3F830745609C02BE9F4D86CF419924E33EE3398F1EE4FE65FD045C1A2EE05C85CDBF2EAE6E4297E000664E4CC21"
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
    console.warn("WebSocket bị đóng, thử kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

// Hàm dùng AI Gemini dự đoán
async function getAIPrediction(pattern) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Dãy kết quả gần đây của trò chơi Tài Xỉu là: ${pattern}.
Dựa vào xu hướng kết quả này, bạn hãy dự đoán kết quả tiếp theo sẽ là gì? Trả lời chỉ bằng một từ: "Tài" hoặc "Xỉu".`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    if (text.includes("Tài")) return "Tài";
    if (text.includes("Xỉu")) return "Xỉu";
    return "Không rõ";
  } catch (err) {
    console.error("Lỗi AI:", err.message);
    return "Lỗi AI";
  }
}

// API Fastify
fastify.get("/api/taixiu", async (request, reply) => {
  const validResults = [...lastResults]
    .reverse()
    .filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length < 1) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: null,
      used_pattern: ""
    };
  }

  const current = validResults[0];
  const total = current.d1 + current.d2 + current.d3;
  const result = total >= 11 ? "Tài" : "Xỉu";
  const currentSession = current.sid;
  const nextSession = currentSession + 1;

  const pattern = validResults
    .slice(0, 6)
    .map(item => {
      const sum = item.d1 + item.d2 + item.d3;
      return sum >= 11 ? "T" : "X";
    })
    .reverse()
    .join("");

  const prediction = await getAIPrediction(pattern);

  return {
    current_result: result,
    current_session: currentSession,
    next_session: nextSession,
    prediction: prediction,
    used_pattern: pattern
  };
});

// Start server
const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Fastify server đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
