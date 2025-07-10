const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3001;

let b52LatestDice = null;
let b52CurrentSession = null;
let b52CurrentMD5 = null;
let b52WS = null;
let b52IntervalCmd = null;
const b52ReconnectInterval = 5000;

function sendB52Cmd1005() {
  if (b52WS && b52WS.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2000 }];
    b52WS.send(JSON.stringify(payload));
  }
}

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
        // Lấy phần tử mới nhất (index 0)
        const latest = json[1].htr[0];
        if (latest && typeof latest.d1 === "number" && typeof latest.d2 === "number" && typeof latest.d3 === "number" && latest.sid) {
          b52LatestDice = {
            d1: latest.d1,
            d2: latest.d2,
            d3: latest.d3,
          };
          b52CurrentSession = latest.sid;

          // Nếu có MD5 trong dữ liệu, gán luôn, giả sử json[1].md5 có thể tồn tại
          if (json[1].md5) {
            b52CurrentMD5 = json[1].md5;
          }
        }
      }
    } catch (e) {
      // im lặng lỗi parse
    }
  });

  b52WS.on("close", () => {
    clearInterval(b52IntervalCmd);
    setTimeout(connectB52WebSocket, b52ReconnectInterval);
  });

  b52WS.on("error", (err) => {
    b52WS.close();
  });
}

connectB52WebSocket();

fastify.get("/api/b52", async (request, reply) => {
  if (!b52LatestDice || !b52CurrentSession) {
    return {
      d1: null,
      d2: null,
      d3: null,
      current_session: null,
      current_md5: b52CurrentMD5 || null,
    };
  }

  return {
    d1: b52LatestDice.d1,
    d2: b52LatestDice.d2,
    d3: b52LatestDice.d3,
    current_session: b52CurrentSession,
    current_md5: b52CurrentMD5 || null,
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
