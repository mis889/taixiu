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
  ws = new WebSocket("wss://websocket.atpman.net/websocket");

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket");

    const authPayload = [
      1,
      "MiniGame",
      "banohu1",
      "ba2007ok",
      {
        info: "{\"ipAddress\":\"2a09:bac5:d46b:263c::3cf:60\",\"userId\":\"daf3a573-8ac5-4db4-9717-256b848044af\",\"username\":\"S8_miss88\",\"timestamp\":1750819930667,\"refreshToken\":\"39d76d58fc7e4b819e097764af7240c8.34dcc325f1fc4e758e832c8f7a960224\"}",
        signature: "876FF9B9E17FE46834CDF5480115F5608989198191507DE16041014BE8E5BAF8296485BFEBBF689AD4AE233A4DA7E5F9B41984757E98E0DBB854C3B6F29724610011D9F5980E8FCAAAE932EE5109CC45B2DEB686C5B94433B6A9B3BFF007DAB706188F634E7B485B4CEF63A1A6F3E99456086974321C775D80803669EEB423ED"
      }
    ];

    ws.send(JSON.stringify(authPayload));
    console.log("🔐 Đã gửi payload xác thực");

    // Gửi lệnh lấy kết quả xúc xắc sau 2 giây
    setTimeout(() => {
      const dicePayload = [
        6,
        "MiniGame",
        "taixiuUnbalancedPlugin",
        { cmd: 2000 }
      ];
      ws.send(JSON.stringify(dicePayload));
      console.log("🎲 Đã gửi lệnh lấy kết quả xúc xắc (cmd: 2000)");
    }, 2000);
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

        console.log(`📥 Phiên ${currentSession}: ${latest.d1} + ${latest.d2} + ${latest.d3} = ${total} → ${currentResult}`);
      }
    } catch (e) {
      // Không log lỗi nhỏ để tránh spam
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket bị đóng, thử kết nối lại sau 5 giây...");
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/club789", async (request, reply) => {
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
