const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3060;

let lastResults = [];
let currentResult = null;
let currentSession = null;

let ws = null;
let reconnectInterval = 5000;

function connectWebSocket() {
  ws = new WebSocket("wss://socketcsmm.onrender.com");

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket");

    // Gửi yêu cầu bắt đầu nhận dữ liệu Tài Xỉu
    const subscribePayload = JSON.stringify({ type: "subscribe", game: "sunwin" });
    ws.send(subscribePayload);
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data.toString());

      if (json.type === "history" && Array.isArray(json.data)) {
        lastResults = json.data.map(item => ({
          sid: item.phien,
          d1: item.x1,
          d2: item.x2,
          d3: item.x3
        }));

        const latest = lastResults[0];
        const total = latest.d1 + latest.d2 + latest.d3;
        currentResult = total >= 11 ? "Tài" : "Xỉu";
        currentSession = latest.sid;

        console.log(`📥 Phiên ${currentSession}: ${latest.d1} + ${latest.d2} + ${latest.d3} = ${total} → ${currentResult}`);
      }
    } catch (err) {
      console.error("❌ Lỗi xử lý WS:", err.message);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng. Đang kết nối lại sau 5 giây...");
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket lỗi:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/club789", async (request, reply) => {
  const validResults = [...lastResults]
    .reverse()
    .filter(item => typeof item.d1 === "number" && typeof item.d2 === "number" && typeof item.d3 === "number");

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
  const prediction = result === "Tài" ? "Xỉu" : "Tài";

  const pattern = validResults
    .slice(0, 6)
    .map(item => {
      const sum = item.d1 + item.d2 + item.d3;
      return sum >= 11 ? "T" : "X";
    })
    .reverse()
    .join("");

  return {
    current_result: result,
    current_session: currentSession,
    next_session: nextSession,
    prediction: prediction,
    used_pattern: pattern
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
