const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3001;

let b52CurrentSession = null;
let b52CurrentMD5 = null;

let b52WS = null;
let b52IntervalCmd = null;
const b52ReconnectInterval = 5000;

// Gửi lệnh để lấy dữ liệu
function sendB52Cmd1005() {
  if (b52WS && b52WS.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2000 }];
    b52WS.send(JSON.stringify(payload));
  }
}

// Kết nối WebSocket tới máy chủ B52
function connectB52WebSocket() {
  b52WS = new WebSocket("wss://mynygwais.hytsocesk.com/websocket");

  b52WS.on("open", () => {
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
    b52WS.send(JSON.stringify(authPayload));

    clearInterval(b52IntervalCmd);
    b52IntervalCmd = setInterval(sendB52Cmd1005, 5000);
  });

  b52WS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        const latest = json[1].htr[0];
        if (latest?.sid) {
          b52CurrentSession = latest.sid;
        }

        if (json[1].md5) {
          b52CurrentMD5 = json[1].md5;
        }
      }
    } catch (e) {
      // Bỏ qua lỗi
    }
  });

  b52WS.on("close", () => {
    clearInterval(b52IntervalCmd);
    setTimeout(connectB52WebSocket, b52ReconnectInterval);
  });

  b52WS.on("error", () => {
    b52WS.close();
  });
}

// Gọi kết nối ngay khi khởi động
connectB52WebSocket();

// API trả về md5 và phiên
fastify.get("/api/hit", async (request, reply) => {
  return {
    md5: b52CurrentMD5 || null,
    phien: b52CurrentSession || null,
  };
});

// Khởi động server
const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`✅ Server B52 đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
