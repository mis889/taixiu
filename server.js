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
const PATTERN_DATA = {
  // Pattern thường
  "ttxttx": { tai: 80, xiu: 20 },
  "xxttxx": { tai: 20, xiu: 80 },
  "ttxxtt": { tai: 75, xiu: 25 },
  "txtxt": { tai: 60, xiu: 40 },
  "xtxtx": { tai: 40, xiu: 60 },

  // Cầu ngắn
  "ttx": { tai: 70, xiu: 30 },
  "xxt": { tai: 30, xiu: 70 },
  "txt": { tai: 65, xiu: 35 },
  "xtx": { tai: 35, xiu: 65 },

  // Bệt ngắn
  "tttt": { tai: 85, xiu: 15 },
  "xxxx": { tai: 15, xiu: 85 },
  "ttttt": { tai: 88, xiu: 12 },
  "xxxxx": { tai: 12, xiu: 88 },
  "tttttt": { tai: 92, xiu: 8 },
  "xxxxxx": { tai: 8, xiu: 92 },
  "ttttttt": { tai: 95, xiu: 5 },
  "xxxxxxx": { tai: 5, xiu: 95 },
  "tttttttt": { tai: 97, xiu: 3 },
  "xxxxxxxx": { tai: 3, xiu: 97 },

  // Đặc biệt Sunwin
  "tttx": { tai: 75, xiu: 25 },
  "xxxt": { tai: 25, xiu: 75 },
  "ttxtx": { tai: 78, xiu: 22 },
  "xxtxt": { tai: 22, xiu: 78 },
  "txtxtx": { tai: 82, xiu: 18 },
  "xtxtxt": { tai: 18, xiu: 82 },
  "ttxtxt": { tai: 85, xiu: 15 },
  "xxtxtx": { tai: 15, xiu: 85 },
  "txtxxt": { tai: 83, xiu: 17 },
  "xtxttx": { tai: 17, xiu: 83 },

  // Pattern zigzag
  "txtx": { tai: 60, xiu: 40 },
  "xtxt": { tai: 40, xiu: 60 },
  "txtxt": { tai: 65, xiu: 35 },
  "xtxtx": { tai: 35, xiu: 65 },
  "txtxtxt": { tai: 70, xiu: 30 },
  "xtxtxtx": { tai: 30, xiu: 70 },

  // Cầu bệt dài đặc biệt (Sunwin)
  "ttttttttttttx": { tai: 95, xiu: 5 },
  "tttttttttttxt": { tai: 5, xiu: 95 },
  "tttttttttttxx": { tai: 5, xiu: 95 },
  "ttttttttttxtt": { tai: 95, xiu: 5 },
  "ttttttttttxtx": { tai: 95, xiu: 5 },
  "ttttttttttxxt": { tai: 95, xiu: 5 },
  "ttttttttttxxx": { tai: 95, xiu: 5 },
  "tttttttttxttt": { tai: 95, xiu: 5 },
  "tttttttttxttx": { tai: 95, xiu: 5 },
  "tttttttttxtxt": { tai: 5, xiu: 95 },
  "tttttttttxtxx": { tai: 5, xiu: 95 },
  "tttttttttxxtt": { tai: 95, xiu: 5 },
  "tttttttttxxtx": { tai: 95, xiu: 5 },
  "tttttttttxxxt": { tai: 5, xiu: 95 },
  "tttttttttxxxx": { tai: 95, xiu: 5 },
  "ttttttttxtttt": { tai: 95, xiu: 5 },
  "ttttttttxtttx": { tai: 95, xiu: 5 },
  "ttttttttxttxt": { tai: 5, xiu: 95 },
  "ttttttttxttxx": { tai: 5, xiu: 95 },
  "ttttttttxtxtt": { tai: 95, xiu: 5 },
  "ttttttttxtxtx": { tai: 95, xiu: 5 },
  "ttttttttxtxxt": { tai: 95, xiu: 5 },
  "ttttttttxtxxx": { tai: 95, xiu: 5 },
  "ttttttttxxttt": { tai: 95, xiu: 5 },
  "ttttttttxxttx": { tai: 95, xiu: 5 },
  "ttttttttxxtxt": { tai: 5, xiu: 95 },
  "ttttttttxxtxx": { tai: 5, xiu: 95 },
  "ttttttttxxxtt": { tai: 95, xiu: 5 },
  "ttttttttxxxtx": { tai: 95, xiu: 5 },
  "ttttttttxxxxt": { tai: 5, xiu: 95 },
  "ttttttttxxxxx": { tai: 5, xiu: 95 },
  "tttttttxttttt": { tai: 95, xiu: 5 },
  "tttttttxttttx": { tai: 95, xiu: 5 },
  "tttttttxtttxt": { tai: 5, xiu: 95 },
  "tttttttxtttxx": { tai: 5, xiu: 95 },
  "tttttttxttxtt": { tai: 95, xiu: 5 },
  "tttttttxttxtx": { tai: 95, xiu: 5 }
};

const SUNWIN_ALGORITHM = {
  "3-10": { tai: 0, xiu: 100 },
  "11": { tai: 10, xiu: 90 },
  "12": { tai: 20, xiu: 80 },
  "13": { tai: 35, xiu: 65 },
  "14": { tai: 45, xiu: 55 },
  "15": { tai: 65, xiu: 35 },
  "16": { tai: 80, xiu: 20 },
  "17": { tai: 90, xiu: 10 },
  "18": { tai: 100, xiu: 0 }
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
