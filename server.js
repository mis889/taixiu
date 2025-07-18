// === SERVER SUNWIN TOOL (FASTIFY + WEBSOCKET) ===
const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

let lastResults = [];
let currentSession = null;

let ws = null;
let reconnectInterval = 5000;
let intervalCmd = null;

const messagesToSend = [
  [1, "MiniGame", "SC_anhlatrumapi1", "binhtool90", {
    info: "{\"ipAddress\":\"2001:ee0:5709:2720:7ba7:fb19:d038:aa91\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...\",\"userId\":\"6a5cf7cf-4486-4be5-a023-529928e2d85c\",\"username\":\"SC_anhlatrumapi1\",\"timestamp\":1752787308659}",
    signature: "5537B01C383416D3BE734483E7A84B7CAFB9ADFE81CE55406B2D455D205F437E..."
  }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Origin": "https://play.sun.win"
    }
  });

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket");

    messagesToSend.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }, i * 600);
    });

    clearInterval(intervalCmd);
    intervalCmd = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on("pong", () => {
    console.log("📶 Ping OK");
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && typeof json[1] === "object") {
        const cmd = json[1].cmd;

        if (cmd === 1003 && json[1].gBB) {
          const { d1, d2, d3, sid } = json[1];
          const tong = d1 + d2 + d3;
          lastResults.unshift({ sid, d1, d2, d3 });
          if (lastResults.length > 20) lastResults.pop();
          currentSession = sid;
        }
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.warn("❌ WebSocket bị đóng, thử kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("⚠️ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

// === API trả về dữ liệu dự đoán Tài/Xỉu ===
fastify.get("/api/sunaxotool", async (request, reply) => {
  const validResults = [...lastResults]
    .reverse()
    .filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length < 1) {
    return {
      Phien: null,
      Ket_qua: null,
      Xuc_xac_1: null,
      Xuc_xac_2: null,
      Xuc_xac_3: null,
      Tong: null
    };
  }

  const current = validResults[0];
  const tong = current.d1 + current.d2 + current.d3;
  const ket_qua = tong >= 11 ? "Tài" : "Xỉu";
  const nextSession = current.sid + 1;
  const prediction = ket_qua === "Tài" ? "Xỉu" : "Tài";

  return {
    Phien: nextSession,
    Ket_qua: prediction,
    Xuc_xac_1: current.d1,
    Xuc_xac_2: current.d2,
    Xuc_xac_3: current.d3,
    Tong: tong
  };
});

// === Khởi động server ===
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
