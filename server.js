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
    info: "{\"ipAddress\":\"2001:ee0:5709:2720:7ba7:fb19:d038:aa91\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsImdlbmRlciI6MCwiZGlzcGxheU5hbWUiOiJ0YW9sYWJpbmgxMjk5IiwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImJvdCI6MCwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzAyLnBuZyIsInVzZXJJZCI6IjZhNWNmN2NmLTQ0ODYtNGJlNS1hMDIzLTUyOTkyOGUyZDg1YyIsInJlZ1RpbWUiOjE3NTI3NjcyOTk2OTgsInBob25lIjoiIiwiY3VzdG9tZXJJZCI6MjgzNTEyODQ1LCJicmFuZCI6InN1bi53aW4iLCJ1c2VybmFtZSI6IlNDX2FuaGxhdHJ1bWFwaTEiLCJ0aW1lc3RhbXAiOjE3NTI3ODczMDg2NTl9.5PQjsPsm2G7SyEnAbNqXtxkxYlMQIwcJpxjh1l_hH6c\",\"userId\":\"6a5cf7cf-4486-4be5-a023-529928e2d85c\",\"username\":\"SC_anhlatrumapi1\",\"timestamp\":1752787308659}",
    signature: "5537B01C383416D3BE734483E7A84B7CAFB9ADFE81CE55406B2D455D205F437E453989E499C153EEDDEB8614D2A347C6E0E1D7335C8C39E8555E23775C0C3B7727DD1C2DBEF76ED82122FD56C83F117C07FC3AD12300BE2207F5046BEFF0D80A979D8146BA495E6425874D46A81DEFCA11427494D22C12C0C90427873AD0BFB3"
  }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsImdlbmRlciI6MCwiZGlzcGxheU5hbWUiOiJ0YW9sYWJpbmgxMjk5IiwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImJvdCI6MCwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzAyLnBuZyIsInVzZXJJZCI6IjZhNWNmN2NmLTQ0ODYtNGJlNS1hMDIzLTUyOTkyOGUyZDg1YyIsInJlZ1RpbWUiOjE3NTI3NjcyOTk2OTgsInBob25lIjoiIiwiY3VzdG9tZXJJZCI6MjgzNTEyODQ1LCJicmFuZCI6InN1bi53aW4iLCJ1c2VybmFtZSI6IlNDX2FuaGxhdHJ1bWFwaTEiLCJ0aW1lc3RhbXAiOjE3NTI3ODczMDg2NTl9.5PQjsPsm2G7SyEnAbNqXtxkxYlMQIwcJpxjh1l_hH6c", {
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
