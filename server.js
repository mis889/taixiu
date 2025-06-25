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

    // Gửi payload xác thực
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

    // Gửi payload lấy lịch sử sau 1s, rồi đều đặn 5s/lần
    setTimeout(sendHistoryRequest, 1000);
    interval = setInterval(sendHistoryRequest, 5000);
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);

      // Kiểm tra có lịch sử Tài Xỉu trong mảng htr
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
      // lỗi json hoặc parse thì thôi
    }
  });

  ws.on("close", () => {
    console.warn("🔌 WebSocket đóng kết nối, thử kết nối lại sau 5s...");
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
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: null,
      used_pattern: "",
    };
  }

  // Lấy 6 bản ghi gần nhất có đầy đủ dice
  const validResults = results
    .filter((r) => r.d1 != null && r.d2 != null && r.d3 != null)
    .slice(0, 6);

  if (!validResults.length) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: null,
      used_pattern: "",
    };
  }

  const current = validResults[0];
  const total = current.d1 + current.d2 + current.d3;
  const currentResult = total >= 11 ? "Tài" : "Xỉu";
  const currentSession = current.sid;
  const nextSession = currentSession + 1;
  const prediction = currentResult === "Tài" ? "Xỉu" : "Tài";

  // Tạo pattern từ 6 kết quả gần nhất, 'T' hoặc 'X', đảo ngược cho dễ nhìn pattern lịch sử
  const pattern = validResults
    .map((r) => (r.d1 + r.d2 + r.d3 >= 11 ? "T" : "X"))
    .reverse()
    .join("");

  return {
    current_result: currentResult,
    current_session: currentSession,
    next_session: nextSession,
    prediction: prediction,
    used_pattern: pattern,
  };
});

fastify.listen({ port: PORT, host: "0.0.0.0" }).then(({ url }) => {
  console.log(`🚀 Server Fastify đang chạy tại ${url}`);
});
