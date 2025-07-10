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

function sendHitCmd2007() {
  if (hitWS && hitWS.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 2007 }];
    hitWS.send(JSON.stringify(payload));
    console.log("📤 Gửi lệnh CMD 2007");
  }
}

function connectHitWebSocket() {
  console.log("🔌 Đang kết nối đến WebSocket HIT...");
  hitWS = new WebSocket("wss://mynygwais.hytsocesk.com/websocket");

  hitWS.on("open", () => {
    console.log("✅ Đã kết nối HIT WebSocket");

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
    console.log("📤 Gửi payload đăng nhập");

    clearInterval(hitIntervalCmd);
    hitIntervalCmd = setInterval(sendHitCmd2007, 5000);
  });

  hitWS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      // Log toàn bộ gói tin về
      console.log("📩 Dữ liệu nhận:", JSON.stringify(json));

      if (Array.isArray(json) && json[1]?.htr) {
        const latest = json[1].htr[0];
        if (
          latest &&
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

          console.log("✅ Cập nhật phiên:", hitCurrentSession);
        }
      }
    } catch (err) {
      console.error("❌ Lỗi parse dữ liệu:", err.message);
    }
  });

  hitWS.on("close", () => {
    console.log("⚠️ WebSocket HIT đóng, thử kết nối lại...");
    clearInterval(hitIntervalCmd);
    setTimeout(connectHitWebSocket, hitReconnectInterval);
  });

  hitWS.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    hitWS.close();
  });
}

connectHitWebSocket();

fastify.get("/api/hit", async (request, reply) => {
  if (!hitLatestDice || !hitCurrentSession) {
    return {
      d1: null,
      d2: null,
      d3: null,
      total: null,
      tai_xiu: null,
      current_session: null,
      current_md5: hitCurrentMD5 || null,
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
    current_md5: hitCurrentMD5 || null,
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server HIT đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
