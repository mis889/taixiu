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
    const payload = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2007 }];
    hitWS.send(JSON.stringify(payload));
  }
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
        accessToken: "1-52de07b06c469b41fbf5bfc289e49bb5",
        reconnect: false,
      },
    ];
    hitWS.send(JSON.stringify(authPayload));
    clearInterval(hitIntervalCmd);
    hitIntervalCmd = setInterval(sendHitCmd2007, 5000);
  });

  hitWS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        const latest = json[1].htr[0];
        if (latest && typeof latest.d1 === "number" && typeof latest.d2 === "number" && typeof latest.d3 === "number" && latest.sid) {
          hitLatestDice = {
            d1: latest.d1,
            d2: latest.d2,
            d3: latest.d3,
          };
          hitCurrentSession = latest.sid;

          if (json[1].md5) {
            hitCurrentMD5 = json[1].md5;
          }
        }
      }
    } catch (e) {
      // ignore parse error
    }
  });

  hitWS.on("close", () => {
    clearInterval(hitIntervalCmd);
    setTimeout(connectHitWebSocket, hitReconnectInterval);
  });

  hitWS.on("error", (err) => {
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
      current_session: null,
      current_md5: hitCurrentMD5 || null,
    };
  }

  return {
    d1: hitLatestDice.d1,
    d2: hitLatestDice.d2,
    d3: hitLatestDice.d3,
    current_session: hitCurrentSession,
    current_md5: hitCurrentMD5 || null,
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
