const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3001;

let hitLatestDice = null;
let hitCurrentSession = null;
let hitCurrentMD5 = null;
let hitWS = null;
let hitIntervalCmd = null;
const hitReconnectInterval = 5000;

// Gửi CMD 2007 để lấy kết quả Tài Xỉu
function sendHitCmd2007() {
  if (hitWS && hitWS.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2007 }];
    hitWS.send(JSON.stringify(payload));
    console.log("📤 Gửi CMD 2007");
  }
}

function connectHitWebSocket() {
  console.log("🔌 Kết nối WebSocket HIT...");
  hitWS = new WebSocket("wss://mynygwais.hytsocesk.com/websocket"); // ĐÃ XOÁ \r

  hitWS.on("open", () => {
    console.log("✅ Đã kết nối HIT");

    const authPayload = [
      1,
      "MiniGame",
      "",
      "",
      {
        agentId: "1",
        accessToken: "1-52de07b06c469b41fbf5bfc289e49bb5",
        reconnect: false,
      },
    ];
    hitWS.send(JSON.stringify(authPayload));
    console.log("📤 Gửi payload xác thực");

    clearInterval(hitIntervalCmd);
    hitIntervalCmd = setInterval(sendHitCmd2007, 5000);
  });

  hitWS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr?.length > 0) {
        const latest = json[1].htr[0];
        if (
          typeof latest.d1 === "number" &&
          typeof latest.d2 === "number" &&
          typeof latest.d3 === "number" &&
          latest.sid
        ) {
          hitLatestDice = {
            d1: latest.d1,
            d2: latest.d2,
            d3: latest.d3,
          };
          hitCurrentSession = latest.sid;
          hitCurrentMD5 = json[1].md5 || null;

          console.log(`🎯 Phiên ${hitCurrentSession} → [${latest.d1}, ${latest.d2}, ${latest.d3}]`);
        }
      }
    } catch (err) {
      console.error("❌ Lỗi xử lý message:", err.message);
    }
  });

  hitWS.on("close", () => {
    console.warn("⚠️ Mất kết nối WebSocket HIT. Thử lại sau 5s...");
    clearInterval(hitIntervalCmd);
    setTimeout(connectHitWebSocket, hitReconnectInterval);
  });

  hitWS.on("error", (err) => {
    console.error("❌ WebSocket lỗi:", err.message);
    hitWS.close();
  });
}

connectHitWebSocket();

// API trả về kết quả HIT mới nhất
fastify.get("/api/hit", async (request, reply) => {
  if (!hitLatestDice || !hitCurrentSession) {
    return {
      d1: null,
      d2: null,
      d3: null,
      total: null,
      tai_xiu: null,
      current_session: null,
      current_md5: null,
    };
  }

  const total = hitLatestDice.d1 + hitLatestDice.d2 + hitLatestDice.d3;
  const tai_xiu = total >= 11 ? "Tài" : "Xỉu";

  return {
    d1: hitLatestDice.d1,
    d2: hitLatestDice.d2,
    d3: hitLatestDice.d3,
    total,
    tai_xiu,
    current_session: hitCurrentSession,
    current_md5: hitCurrentMD5,
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server đang chạy tại ${address}`);
  } catch (err) {
    console.error("❌ Lỗi khởi động server:", err);
    process.exit(1);
  }
};

start();

