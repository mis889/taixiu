const Fastify = require("fastify");
const WebSocket = require("ws");

// ---------------- Thuật toán dự đoán ----------------
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

  const mostCommonTotal = Object.entries(totalsMap).sort((a, b) => b[1] - a[1])[0][0];
  const mostCommonType = count["Tài"] >= count["Xỉu"] ? "Tài" : "Xỉu";

  return {
    tai_count: count["Tài"],
    xiu_count: count["Xỉu"],
    most_common_total: parseInt(mostCommonTotal),
    most_common_type: mostCommonType
  };
}

function duDoanSunwin200kVip(totals) {
  if (totals.length < 4) {
    return {
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu, cần ít nhất 4 phiên.",
      history_summary: taiXiuStats(totals)
    };
  }

  const last4 = totals.slice(-4);
  const last3 = totals.slice(-3);
  const last6 = totals.slice(-6);
  const lastTotal = totals[totals.length - 1];
  const lastResult = getTaiXiu(lastTotal);

  const rules = [
    () => {
      if (last4[0] === last4[2] && last4[0] === last4[3] && last4[0] !== last4[1]) {
        return {
          prediction: "Tài",
          confidence: 85,
          reason: `Cầu đặc biệt ${last4.join("-")}. Bắt Tài theo công thức đặc biệt.`
        };
      }
    },
    () => {
      if (last3[0] === last3[2] && last3[0] !== last3[1]) {
        return {
          prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
          confidence: 83,
          reason: `Cầu sandwich ${last3.join("-")}. Bẻ cầu!`
        };
      }
    },
    () => {
      const special = [7, 9, 10];
      const count = last3.filter(t => special.includes(t)).length;
      if (count >= 2) {
        return {
          prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
          confidence: 81,
          reason: `≥2 số đặc biệt (${special.join(", ")}) gần nhất. Bẻ cầu!`
        };
      }
    },
    () => {
      const freq = last6.filter(t => t === lastTotal).length;
      if (freq >= 3) {
        return {
          prediction: getTaiXiu(lastTotal),
          confidence: 80,
          reason: `Số ${lastTotal} lặp lại ${freq} lần. Bắt theo nghiêng cầu!`
        };
      }
    },
    () => {
      if (last3[0] === last3[2] || last3[1] === last3[2]) {
        return {
          prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
          confidence: 77,
          reason: `Cầu lặp ${last3.join("-")}. Bẻ cầu theo dạng A-B-A hoặc A-B-B.`
        };
      }
    }
  ];

  for (let rule of rules) {
    const result = rule();
    if (result) {
      result.history_summary = taiXiuStats(totals);
      return result;
    }
  }

  const result = {
    prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
    confidence: 71,
    reason: "Không có cầu đặc biệt nào, bẻ cầu mặc định.",
    history_summary: taiXiuStats(totals)
  };
  return result;
}

// ---------------- WebSocket và Fastify ----------------
const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

let lastResults = [];
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
    console.log("✅ Đã kết nối WebSocket");

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
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng. Thử kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

// ---------------- API ----------------
fastify.get("/api/taixiu", async (req, reply) => {
  const validResults = [...lastResults]
    .reverse()
    .filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length < 4) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu",
      pattern13: "",
      history_summary: {}
    };
  }

  const current = validResults[0];
  const total = current.d1 + current.d2 + current.d3;
  const result = getTaiXiu(total);
  const currentSession = current.sid;
  const nextSession = currentSession + 1;

  const totals = validResults.map(r => r.d1 + r.d2 + r.d3);
  const pattern13 = validResults
    .slice(0, 13)
    .map(r => getTaiXiu(r.d1 + r.d2 + r.d3)[0]) // T hoặc X
    .reverse()
    .join("");

  const predictionData = duDoanSunwin200kVip(totals);

  return {
    current_result: result,
    current_session: currentSession,
    next_session: nextSession,
    prediction: predictionData.prediction,
    confidence: predictionData.confidence,
    reason: predictionData.reason,
    pattern13: pattern13,
    history_summary: predictionData.history_summary
  };
});

// ---------------- Start Server ----------------
const start = async () => {
  try {
    const addr = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server chạy tại ${addr}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
