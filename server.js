const Fastify = require("fastify");
const WebSocket = require("ws");
const cors = require("cors");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

// Kết quả hiện tại
let currentData = {
  id: "axobantool",
  id_phien: null,
  ket_qua: "", // VD: "2-3-4"
};

// Thiết lập WebSocket đến máy chủ game
let ws = null;
let reconnectInterval = 5000;

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/wsbinary?token=...");

  ws.onopen = () => {
    console.log("✅ Đã kết nối WebSocket");
    sendCmd1005();

    // Gửi CMD 1005 mỗi 2 giây
    setInterval(sendCmd1005, 2000);
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);

      if (data[0] === 6 && data[2] === "taixiuPlugin") {
        const payload = data[3];
        const resultStr = payload?.result || "";

        // Lọc kết quả nếu đúng dạng 3 số
        const match = resultStr.match(/^(\d+)-(\d+)-(\d+)$/);
        if (match) {
          currentData.ket_qua = resultStr;
          currentData.id_phien = payload?.session || null;
        }
      }
    } catch (e) {
      console.error("Lỗi WebSocket:", e.message);
    }
  };

  ws.onclose = () => {
    console.log("❌ Mất kết nối, đang thử lại...");
    setTimeout(connectWebSocket, reconnectInterval);
  };

  ws.onerror = (err) => {
    console.error("WebSocket lỗi:", err.message);
  };
}

function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

// Giao tiếp API để đọc kết quả
fastify.register(require('@fastify/cors'), { origin: '*' });

fastify.get("/taixiu", async (req, reply) => {
  const { id_phien, ket_qua } = currentData;

  let d1 = null, d2 = null, d3 = null, result = "?";
  const match = ket_qua.match(/^(\d+)-(\d+)-(\d+)$/);

  if (match) {
    d1 = parseInt(match[1]);
    d2 = parseInt(match[2]);
    d3 = parseInt(match[3]);
    const total = d1 + d2 + d3;
    result = total <= 10 ? "Xỉu" : "Tài";
  }

  return {
    id: ["@axobantool", "@hatronghoann"],
    phien: id_phien,
    Xuc_xac_1: d1,
    Xuc_xac_2: d2,
    Xuc_xac_3: d3,
    ket_qua: d1 && d2 && d3 ? result : "?"
  };
});

// Start server
fastify.listen({ port: PORT }, (err, address) => {
  if (err) throw err;
  console.log(`🚀 Server đang chạy tại ${address}`);
});

// Khởi động kết nối WebSocket
connectWebSocket();
