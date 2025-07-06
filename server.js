// server.js
const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

let lastResults = [];
let ws = null;
let reconnectInterval = 5000;
let intervalCmd = null;

const PATTERN_DATA = {
  "ttxttx": { tai: 80, xiu: 20 },
  "xxttxx": { tai: 20, xiu: 80 },
  "ttxxtt": { tai: 75, xiu: 25 },
  "txtxt": { tai: 60, xiu: 40 },
  "xtxtx": { tai: 40, xiu: 60 },
  "ttx": { tai: 70, xiu: 30 },
  "xxt": { tai: 30, xiu: 70 },
  "txt": { tai: 65, xiu: 35 },
  "xtx": { tai: 35, xiu: 65 },
  "tttt": { tai: 85, xiu: 15 },
  "xxxx": { tai: 15, xiu: 85 },
  "ttttt": { tai: 88, xiu: 12 },
  "xxxxx": { tai: 12, xiu: 88 },
  "tttttt": { tai: 92, xiu: 8 },
  "xxxxxx": { tai: 8, xiu: 92 },
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
  "ttttttt": { tai: 95, xiu: 5 },
  "xxxxxxx": { tai: 5, xiu: 95 },
  "tttttttt": { tai: 97, xiu: 3 },
  "xxxxxxxx": { tai: 3, xiu: 97 },
  "txtx": { tai: 60, xiu: 40 },
  "xtxt": { tai: 40, xiu: 60 },
  "txtxt": { tai: 65, xiu: 35 },
  "xtxtx": { tai: 35, xiu: 65 },
  "txtxtxt": { tai: 70, xiu: 30 },
  "xtxtxtx": { tai: 30, xiu: 70 }
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

function getTaiXiu(total) {
  return total >= 11 ? "Tài" : "Xỉu";
}

function taiXiuStats(totals) {
  const count = { "Tài": 0, "Xỉu": 0 };
  const totalsMap = {};

  for (let t of totals) {
    const type = getTaiXiu(t);
    count[type]++;
    totalsMap[t] = (totalsMap[t] || 0) + 1;
  }

  const mostCommonTotal = Object.entries(totalsMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const mostCommonType = count["Tài"] >= count["Xỉu"] ? "Tài" : "Xỉu";

  return {
    tai_count: count["Tài"],
    xiu_count: count["Xỉu"],
    most_common_total: mostCommonTotal ? parseInt(mostCommonTotal) : null,
    most_common_type: mostCommonTotal ? mostCommonType : null
  };
}

function duDoanSunwin200kVip(totals) {
  if (totals.length < 4) {
    return {
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu",
      pattern: "",
      history_summary: taiXiuStats(totals)
    };
  }

  const pattern = totals.slice(-13).map(t => getTaiXiu(t)[0].toLowerCase()).join("");
  if (pattern && PATTERN_DATA[pattern]) {
    const rates = PATTERN_DATA[pattern];
    const prediction = rates.tai > rates.xiu ? "Tài" : "Xỉu";
    const confidence = Math.max(rates.tai, rates.xiu);
    return {
      prediction,
      confidence,
      reason: `Theo pattern '${pattern}'`,
      pattern,
      history_summary: taiXiuStats(totals)
    };
  }

  const lastTotal = totals[totals.length - 1];
  let rate = SUNWIN_ALGORITHM[lastTotal];
  if (!rate && lastTotal >= 3 && lastTotal <= 10) rate = SUNWIN_ALGORITHM["3-10"];
  if (rate) {
    const prediction = rate.tai > rate.xiu ? "Tài" : "Xỉu";
    const confidence = Math.max(rate.tai, rate.xiu);
    return {
      prediction,
      confidence,
      reason: `Theo thống kê tổng ${lastTotal}`,
      pattern,
      history_summary: taiXiuStats(totals)
    };
  }

  const fallback = getTaiXiu(lastTotal) === "Tài" ? "Xỉu" : "Tài";
  return {
    prediction: fallback,
    confidence: 60,
    reason: "Không khớp pattern, dự đoán ngược cầu",
    pattern,
    history_summary: taiXiuStats(totals)
  };
}

// WebSocket connect
function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjB9.p56b5g73I9wyoVu4db679bOvVeFJWVjGDg_ulBXyav8");

  ws.on("open", () => {
    console.log("✅ WebSocket đã kết nối");
    const authPayload = [1, "MiniGame", "SC_xigtupou", "conga999", {
      info: JSON.stringify({
        ipAddress: "2a09:bac5:d46e:25b9::3c2:39",
        userId: "eff718a2-31db-4dd5-acb5-41f8cfd3e486",
        username: "SC_miss88",
        timestamp: Date.now(),
        refreshToken: "22aadcb93490422b8d713f8776329a48.9adf6a5293d8443a888edd3ee802b9f4"
      }),
      signature: "06FBBB7B38F79CBFCD34485EEEDF4104E542C26114984D0E9155073FD73E4C23CDCF1029B8F75B26427D641D5FE7BC4B231ABB0D2F6EBC76ED6EDE56B640ED161DEA92A6340AD911AD3D029D8A39E081EB9463BCA194C6B7230C89858723A9E3599868CAEC4D475C22266E4B299BA832D9E20BC3374679CA4F880593CF5D5845"
    }];
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
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng. Thử lại sau...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/taixiu", async (request, reply) => {
  const validResults = [...lastResults]
    .reverse()
    .filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length < 4) {
    return duDoanSunwin200kVip([]);
  }

  const totals = validResults.map(i => i.d1 + i.d2 + i.d3);
  return duDoanSunwin200kVip(totals);
});

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server đang chạy tại ${address}`);
});
