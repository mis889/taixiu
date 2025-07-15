const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

let lastResults = [];
let currentResult = null;
let currentSession = null;

let ws = null;
let reconnectInterval = 5000;
let intervalCmd = null;

function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXhvZGF5In0.DMD395i2WINL3cAb8YjfVcYaod9ltA2XiH8CY35vv8s");

  ws.on("open", () => {
    console.log("✅ Kết nối WebSocket thành công");
    const authPayload = [
      1,
      "MiniGame",
      "SC_xigtupou",
      "conga999",
      {
        info: "{\"ipAddress\":\"2a09:bac5:d46e:25b9::3c2:39\",\"userId\":\"eff718a2-31db-4dd5-acb5-41f8cfd3e486\",\"username\":\"SC_miss88\",\"timestamp\":1751782535424,\"refreshToken\":\"22aadcb93490422b8d713f8776329a48.9adf6a5293d8443a888edd3ee802b9f4\"}",
        signature: "06FBBB7B38F79CBFCD34485EEEDF4104E542C26114984D0E9155073FD73E4C23CDCF1029B8F75B26427D641D5FE7BC4B231ABB0D2F6EBC76ED6EDE56B640ED161DEA92A6340AD911AD3D029D8A39E081EB9463BCA194C6B7230C89858723A9E3599868CAEC4D475C22266E4B299BA832D9E20BC3374679CA4F880593CF5D5845"
      }
    ];
    ws.send(JSON.stringify(authPayload));
    clearInterval(intervalCmd);
    intervalCmd = setInterval(sendCmd1005, 5000);
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
        currentResult = total >= 11 ? "T" : "X";
        currentSession = latest.sid;
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng, thử kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

// === THUẬT TOÁN PHÂN TÍCH ===
// === THUẬT TOÁN PATTERN ANALYSIS NÂNG CAO ===
const PATTERN_DATA = {
  // Các pattern cơ bản
  "tttt": { tai: 73, xiu: 27 }, "xxxx": { tai: 27, xiu: 73 },
  "tttttt": { tai: 83, xiu: 17 }, "xxxxxx": { tai: 17, xiu: 83 },
  "ttttx": { tai: 40, xiu: 60 }, "xxxxt": { tai: 60, xiu: 40 },
  "ttttttx": { tai: 30, xiu: 70 }, "xxxxxxt": { tai: 70, xiu: 30 },
  "ttxx": { tai: 62, xiu: 38 }, "xxtt": { tai: 38, xiu: 62 },
  "ttxxtt": { tai: 32, xiu: 68 }, "xxttxx": { tai: 68, xiu: 32 },
  "txx": { tai: 60, xiu: 40 }, "xtt": { tai: 40, xiu: 60 },
  "txxtx": { tai: 63, xiu: 37 }, "xttxt": { tai: 37, xiu: 63 },
  "tttxt": { tai: 60, xiu: 40 }, "xxxtx": { tai: 40, xiu: 60 },
  "tttxx": { tai: 60, xiu: 40 }, "xxxtt": { tai: 40, xiu: 60 },
  "txxt": { tai: 60, xiu: 40 }, "xttx": { tai: 40, xiu: 60 },
  "ttxxttx": { tai: 30, xiu: 70 }, "xxttxxt": { tai: 70, xiu: 30 },

  // Bổ sung pattern cầu lớn
  "tttttttt": { tai: 88, xiu: 12 }, "xxxxxxxx": { tai: 12, xiu: 88 },
  "tttttttx": { tai: 25, xiu: 75 }, "xxxxxxxxt": { tai: 75, xiu: 25 },
  "tttttxxx": { tai: 35, xiu: 65 }, "xxxxtttt": { tai: 65, xiu: 35 },
  "ttttxxxx": { tai: 30, xiu: 70 }, "xxxxtttx": { tai: 70, xiu: 30 },

  // Pattern đặc biệt cho Sunwin
  "txtxtx": { tai: 68, xiu: 32 }, "xtxtxt": { tai: 32, xiu: 68 },
  "ttxtxt": { tai: 55, xiu: 45 }, "xxtxtx": { tai: 45, xiu: 55 },
  "txtxxt": { tai: 60, xiu: 40 }, "xtxttx": { tai: 40, xiu: 60 },

  // Pattern nâng cao và zigzag
  "ttx": { tai: 65, xiu: 35 }, "xxt": { tai: 35, xiu: 65 },
  "txt": { tai: 58, xiu: 42 }, "xtx": { tai: 42, xiu: 58 },
  "tttx": { tai: 70, xiu: 30 }, "xxxt": { tai: 30, xiu: 70 },
  "ttxt": { tai: 63, xiu: 37 }, "xxtx": { tai: 37, xiu: 63 },
  "txxx": { tai: 25, xiu: 75 }, "xttt": { tai: 75, xiu: 25 },
  "ttxtx": { tai: 62, xiu: 38 }, "xxtxt": { tai: 38, xiu: 62 },
  "ttxxt": { tai: 55, xiu: 45 }, "xxttx": { tai: 45, xiu: 55 },
  "ttxttx": { tai: 60, xiu: 40 }, "xxtxxt": { tai: 40, xiu: 60 },
  "ttxxtx": { tai: 58, xiu: 42 }, "ttxtxtx": { tai: 62, xiu: 38 },
  "ttxxtxt": { tai: 55, xiu: 45 }, "ttxtxxt": { tai: 65, xiu: 35 },
  "ttxtxttx": { tai: 70, xiu: 30 }, "ttxxtxtx": { tai: 68, xiu: 32 },
  "ttxtxxtx": { tai: 72, xiu: 28 }, "ttxxtxxt": { tai: 75, xiu: 25 },

  // Zigzag
  "txtx": { tai: 52, xiu: 48 }, "xtxt": { tai: 48, xiu: 52 },
  "txtxt": { tai: 53, xiu: 47 }, "xtxtx": { tai: 47, xiu: 53 },
  "txtxtx": { tai: 55, xiu: 45 }, "xtxtxt": { tai: 45, xiu: 55 },
  "txtxtxt": { tai: 57, xiu: 43 }, "xtxtxtx": { tai: 43, xiu: 57 },

  // Đặc biệt kết hợp
  "ttxxttxx": { tai: 38, xiu: 62 }, "xxttxxtt": { tai: 62, xiu: 38 },
  "ttxxxttx": { tai: 45, xiu: 55 }, "xxttxxxt": { tai: 55, xiu: 45 },
  "ttxtxttx": { tai: 50, xiu: 50 }, "xxtxtxxt": { tai: 50, xiu: 50 }
};

const BIG_STREAK_DATA = {
  tai: {
    3: { next_tai: 65, next_xiu: 35 },
    4: { next_tai: 70, next_xiu: 30 },
    5: { next_tai: 75, next_xiu: 25 },
    6: { next_tai: 80, next_xiu: 20 },
    7: { next_tai: 85, next_xiu: 15 },
    8: { next_tai: 88, next_xiu: 12 },
    9: { next_tai: 90, next_xiu: 10 },
    "10+": { next_tai: 92, next_xiu: 8 }
  },
  xiu: {
    3: { next_tai: 35, next_xiu: 65 },
    4: { next_tai: 30, next_xiu: 70 },
    5: { next_tai: 25, next_xiu: 75 },
    6: { next_tai: 20, next_xiu: 80 },
    7: { next_tai: 15, next_xiu: 85 },
    8: { next_tai: 12, next_xiu: 88 },
    9: { next_tai: 10, next_xiu: 90 },
    "10+": { next_tai: 8, next_xiu: 92 }
  }
};

const SUM_STATS = {
  "3-10": { tai: 0, xiu: 100 },
  11: { tai: 15, xiu: 85 },
  12: { tai: 25, xiu: 75 },
  13: { tai: 40, xiu: 60 },
  14: { tai: 50, xiu: 50 },
  15: { tai: 60, xiu: 40 },
  16: { tai: 75, xiu: 25 },
  17: { tai: 85, xiu: 15 },
  18: { tai: 100, xiu: 0 }
};


function predictByPattern(pattern) {
  const p = PATTERN_DATA[pattern];
  if (!p) return null;
  return p.tai > p.xiu ? "Tài" : "Xỉu";
}

function predictByTotal(total) {
  if (total <= 10) return "Xỉu";
  const rule = SUNWIN_ALGORITHM[total.toString()];
  if (!rule) return null;
  return rule.tai > rule.xiu ? "Tài" : "Xỉu";
}

// === API PHÂN TÍCH ===
fastify.get("/api/toolaxosun", async (request, reply) => {
  const validResults = [...lastResults].reverse().filter(item => item.d1 && item.d2 && item.d3);
  if (validResults.length < 13) {
    return {
      phien_cu: null,
      ket_qua: null,
      xuc_xac: [],
      phien_hien_tai: null,
      du_doan: null,
      thanh_cau: "",
      id: "@axobantool"
    };
  }

  const current = validResults[0];
  const total = current.d1 + current.d2 + current.d3;
  const ketQua = total >= 11 ? "Tài" : "Xỉu";
  const phienCu = current.sid;
  const phienMoi = phienCu + 1;

  const thanhCau = validResults.slice(0, 13).map(item => {
    const sum = item.d1 + item.d2 + item.d3;
    return sum >= 11 ? "t" : "x";
  }).reverse().join("");

  let duDoan = predictByPattern(thanhCau);
  if (!duDoan) {
    duDoan = ketQua === "Tài" ? "Xỉu" : "Tài";
  }

  return {
    phien_cu: phienCu,
    ket_qua: ketQua,
    xuc_xac: [current.d1, current.d2, current.d3],
    phien_hien_tai: phienMoi,
    du_doan: duDoan,
    thanh_cau: thanhCau,
    id: "@axobantool"
  };
});

// === KHỞI ĐỘNG SERVER ===
const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
