// server.js
const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

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
    console.log("✅ Đã kết nối WebSocket");

    const authPayload = [
      1,
      "MiniGame",
      "SC_xigtupou",
      "conga999",
      {
        info: JSON.stringify({
          ipAddress: "127.0.0.1",
          userId: "abc-123",
          username: "SC_demo",
          timestamp: Date.now(),
          refreshToken: "demo.token.here"
        }),
        signature: "DEMO_SIGNATURE"
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
    } catch (e) {
      console.error("❌ Parse lỗi:", e.message);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng. Đang thử lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/axocuto", async () => {
  const validResults = [...lastResults].reverse().filter(item => item.d1 && item.d2 && item.d3);
  if (validResults.length < 1) {
    return {
      "Ket_qua": null,
      "Phien": null,
      "Tong": null,
      "Xuc_xac_1": null,
      "Xuc_xac_2": null,
      "Xuc_xac_3": null,
      "id": "@hatronghoann"
    };
  }

  const current = validResults[0];
  const tong = current.d1 + current.d2 + current.d3;
  const ket_qua = tong >= 11 ? "Tài" : "Xỉu";

  return {
    "Ket_qua": ket_qua,
    "Phien": current.sid,
    "Tong": tong,
    "Xuc_xac_1": current.d1,
    "Xuc_xac_2": current.d2,
    "Xuc_xac_3": current.d3,
    "id": "@hatronghoann"
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Fastify server đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
