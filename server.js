const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3003;

let hitResults = [];
let hitWS = null;
let hitInterval = null;

const PATTERN_MAP = {
  "TXT": "Xỉu", 
  "TTXX": "Tài", 
  "XXTXX": "Tài", 
  "TXXXXTX": "Xỉu",
  "XTTTXTT": "Tài",
  "XTTTXTX": "Xỉu",
  "XTTTXX": "Tài",
  "XTTTXXT": "Tài",
  "XTTTXXX": "Tài",
  "XTTXTT": "Tài",
  "XTTXTTT": "Tài",
  "XTTXTTX": "Tài",
  "XTTXTX": "Xỉu",
  "XTTXTXT": "Tài",
  "XTTXTXX": "Xỉu",
  "XTTXX": "Xỉu",
  "XTTXXT": "Xỉu",
  "XTTXXTT": "Tài",
  "XTTXXTX": "Xỉu",
  "XTTXXX": "Tài",
  "XTTXXXT": "Xỉu",
  "XTTXXXX": "Tài",
  "XTXTTT": "Tài",
  "XTXTTTT": "Tài",
  "XTXTTTX": "Xỉu",
  "XTXTTXT": "Xỉu",
  "XTXTTXX": "Tài",
  "XTXTXTT": "Tài",
  "XTXTXTX": "Xỉu",
  "XXXT": "Tài"
};

function getDuDoanFromPattern(pattern) {
  const keys = Object.keys(PATTERN_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pattern.toUpperCase().endsWith(key)) return PATTERN_MAP[key];
  }
  return "?";
}

function connectHitWebSocket() {
  hitWS = new WebSocket("wss://mynygwais.hytsocesk.com/websocket");

  hitWS.on("open", () => {
    const authPayload = [
      1,
      "MiniGame",
      "",
      "",
      {
        agentId: "1",
        accessToken: "1-f610cfb16979ea7c1349fa091913c30b",
        reconnect: true,
      },
    ];
    hitWS.send(JSON.stringify(authPayload));

    clearInterval(hitInterval);
    hitInterval = setInterval(() => {
      const taiXiuPayload = [
        6,
        "MiniGame",
        "taixiuPlugin",
        { cmd: 1005 },
      ];
      hitWS.send(JSON.stringify(taiXiuPayload));
    }, 5000);
  });

  hitWS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        hitResults = json[1].htr.map((item) => ({
          sid: item.sid,
          d1: item.d1,
          d2: item.d2,
          d3: item.d3,
        }));
      }
    } catch (e) {}
  });

  hitWS.on("close", () => {
    clearInterval(hitInterval);
    setTimeout(connectHitWebSocket, 5000);
  });

  hitWS.on("error", () => {
    hitWS.close();
  });
}

connectHitWebSocket();
fastify.register(cors);

// API tương tự /axobantol
fastify.get("/api/hit", async () => {
  const validResults = hitResults
    .filter(r => r.d1 && r.d2 && r.d3)
    .sort((a, b) => b.sid - a.sid);

  if (validResults.length < 1) {
    return { message: "Không đủ dữ liệu." };
  }

  const current = validResults[0];
  const sum = current.d1 + current.d2 + current.d3;
  const ketQua = sum >= 11 ? "Tài" : "Xỉu";
  const xucxac = `${current.d1},${current.d2},${current.d3}`;
  const nextPhien = current.sid + 1;

  const pattern = validResults
    .slice(0, 13)
    .map(r => (r.d1 + r.d2 + r.d3 >= 11 ? "t" : "x"))
    .reverse()
    .join("");

  const duDoan = getDuDoanFromPattern(pattern.toUpperCase());

  return {
    id: "@axobantool",
    phien_cu: current.sid,
    ket_qua: ketQua,
    xuc_xac: xucxac,
    phien_moi: nextPhien,
    pattern: pattern,
    du_doan: duDoan
  };
});

// Start server
const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 HIT Server chạy tại ${address}`);
  } catch (err) {
    console.error("❌ Lỗi server:", err);
    process.exit(1);
  }
};

start();

