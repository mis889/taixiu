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
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjB9.p56b5g73I9wyoVu4db679bOvVeFJWVjGDg_ulBXyav8");

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
  "ttxttx": { tai: 80, xiu: 20 }, "xxttxx": { tai: 20, xiu: 80 },
  "ttxxtt": { tai: 75, xiu: 25 }, "txtxt": { tai: 60, xiu: 40 },
  "xtxtx": { tai: 40, xiu: 60 }, "ttx": { tai: 70, xiu: 30 },
  "xxt": { tai: 30, xiu: 70 }, "txt": { tai: 65, xiu: 35 },
  "xtx": { tai: 35, xiu: 65 }, "tttt": { tai: 85, xiu: 15 },
  "xxxx": { tai: 15, xiu: 85 }, "ttttt": { tai: 88, xiu: 12 },
  "xxxxx": { tai: 12, xiu: 88 }, "tttttt": { tai: 92, xiu: 8 },
  "xxxxxx": { tai: 8, xiu: 92 }, "tttx": { tai: 75, xiu: 25 },
  "xxxt": { tai: 25, xiu: 75 }, "ttxxtt": { tai: 80, xiu: 20 },
  "ttxtx": { tai: 78, xiu: 22 }, "xxtxt": { tai: 22, xiu: 78 },
  "txtxtx": { tai: 82, xiu: 18 }, "xtxtxt": { tai: 18, xiu: 82 },
  "ttxtxt": { tai: 85, xiu: 15 }, "xxtxtx": { tai: 15, xiu: 85 },
  "txtxxt": { tai: 83, xiu: 17 }, "xtxttx": { tai: 17, xiu: 83 },
  "ttttttt": { tai: 95, xiu: 5 }, "xxxxxxx": { tai: 5, xiu: 95 },
  "tttttttt": { tai: 97, xiu: 3 }, "xxxxxxxx": { tai: 3, xiu: 97 },
  "txtx": { tai: 60, xiu: 40 }, "xtxt": { tai: 40, xiu: 60 },
  "txtxt": { tai: 65, xiu: 35 }, "xtxtx": { tai: 35, xiu: 65 },
  "txtxtxt": { tai: 70, xiu: 30 }, "xtxtxtx": { tai: 30, xiu: 70 }
};

function predictByPattern(pattern) {
  const p = PATTERN_DATA[pattern];
  if (!p) return null;
  return p.tai > p.xiu ? "Tài" : "Xỉu";
}

// === ĐẾM ĐÚNG SAI TOÀN CỤC ===
let correctCount = 0;
let totalCount = 0;

// === API PHÂN TÍCH ===
fastify.get("/api/toolaxovip", async (request, reply) => {
  const validResults = [...lastResults].reverse().filter(item => item.d1 && item.d2 && item.d3);
  if (validResults.length < 13) {
    return {
      phien_cu: null,
      ket_qua: null,
      xuc_xac: [],
      phien_moi: null,
      du_doan: null,
      thanh_cau: "",
      lich_su: [],
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

  totalCount++;
  if (duDoan === ketQua) correctCount++;

  const lichSu = [
    {
      phien: phienCu,
      du_doan: duDoan,
      ket_qua: ketQua,
      dung: `${correctCount}/${totalCount}`
    }
  ];

  return {
    phien_cu: phienCu,
    ket_qua: ketQua,
    xuc_xac: [current.d1, current.d2, current.d3],
    phien_moi: phienMoi,
    du_doan: duDoan,
    thanh_cau: thanhCau,
    lich_su: lichSu,
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
