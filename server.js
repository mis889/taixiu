const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3004;

let results = [];
let ws = null;
let interval = null;

function connect() {
  ws = new WebSocket("wss://minygwzi.windlbay9.net/websocket");

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket Tài Xỉu mới");

    const authPayload = [
      1,
      "MiniGame",
      "",
      "",
      {
        agentId: "1",
        accessToken: "37-d20326ee0724ff5475df14239f779cd1",
        reconnect: false,
      },
    ];
    ws.send(JSON.stringify(authPayload));

    setTimeout(sendHistoryRequest, 1000);
    interval = setInterval(sendHistoryRequest, 5000);
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr && Array.isArray(json[1].htr)) {
        results = json[1].htr.map((item) => ({
          sid: item.sid,
          d1: item.d1,
          d2: item.d2,
          d3: item.d3,
        }));
        console.log("🔄 Cập nhật kết quả lịch sử, số bản ghi:", results.length);
      }
    } catch (e) {
      // Bỏ qua lỗi
    }
  });

  ws.on("close", () => {
    console.warn("🔌 WebSocket đóng kết nối, thử lại sau 5s...");
    clearInterval(interval);
    setTimeout(connect, 5000);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

function sendHistoryRequest() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

connect();

fastify.get("/api/win79", async (request, reply) => {
  if (!results.length) {
    return {
      ket_qua: null,
      phien: null,
      d1: null,
      d2: null,
      d3: null,
    };
  }

  const valid = results.find(r => r.d1 != null && r.d2 != null && r.d3 != null);

  if (!valid) {
    return {
      ket_qua: null,
      phien: null,
      d1: null,
      d2: null,
      d3: null,
    };
  }

  const total = valid.d1 + valid.d2 + valid.d3;
  const ket_qua = total >= 11 ? "Tài" : "Xỉu";

  return {
    ket_qua,
    phien: valid.sid,
    d1: valid.d1,
    d2: valid.d2,
    d3: valid.d3,
  };
});

fastify.listen({ port: PORT, host: "0.0.0.0" }).then(({ url }) => {
  console.log(`🚀 Server Fastify đang chạy tại ${url}`);
});
