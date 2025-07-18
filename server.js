const Fastify = require("fastify");
const WebSocket = require("ws");
const cors = require("@fastify/cors");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

// Biến lưu kết quả hiện tại
let currentData = {
  id_phien: null,
  ket_qua: "", // dạng "1-2-3"
};

fastify.register(cors);

// API trả kết quả xúc xắc
fastify.get("/taixiu", async (request, reply) => {
  const { id_phien, ket_qua } = currentData;

  let d1 = null, d2 = null, d3 = null, result = "?";
  const match = ket_qua.match(/^(\d+)-(\d+)-(\d+)/);
  
  if (match) {
    d1 = parseInt(match[1]);
    d2 = parseInt(match[2]);
    d3 = parseInt(match[3]);
    const total = d1 + d2 + d3;
    result = total <= 10 ? "Xỉu" : "Tài";
  }

  reply.send({
    id: ["@axobantool", "@hatronghoann"],
    phien: id_phien,
    Xuc_xac_1: d1,
    Xuc_xac_2: d2,
    Xuc_xac_3: d3,
    ket_qua: d1 && d2 && d3 ? result : "?"
  });
});

// Khởi động WebSocket client
let ws = null;
const reconnect = () => {
  if (ws) ws.close();

  ws = new WebSocket("wss://websocket.azhkthg1.net/wsbinary?token=..."); // thay token thật

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket");
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (Array.isArray(msg) && msg[0] === 7 && msg[2] === "taixiuPlugin") {
        const { result, session } = msg[3];
        currentData.id_phien = session;
        currentData.ket_qua = result;
        console.log(`🎲 Phiên ${session} kết quả: ${result}`);
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.log("🔁 Mất kết nối WebSocket. Thử lại sau 5s...");
    setTimeout(reconnect, 5000);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err);
  });
};

reconnect();

fastify.listen({ port: PORT }, (err, address) => {
  if (err) throw err;
  console.log(`🚀 Server đang chạy tại ${address}`);
});

