// === FULL CODE FASTIFY SERVER + DỰ ĐOÁN TÀI/XỈU ===
const Fastify = require("fastify");
const WebSocket = require("ws");
const PORT = process.env.PORT || 3060;
const fastify = Fastify({ logger: false });

let lastResults = [];
let currentResult = null;
let currentSession = null;
let ws = null;
let reconnectInterval = 5000;

function getTaiXiu(total) {
  return total >= 11 ? "Tài" : "Xỉu";
}

function taiXiuStats(totalsList) {
  const Counter = (arr) => arr.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const types = totalsList.map(getTaiXiu);
  const typeCount = Counter(types);
  const totalCount = Counter(totalsList);
  const mostCommonTotal = Object.entries(totalCount).sort((a, b) => b[1] - a[1])[0][0];
  const mostCommonType = (typeCount["Tài"]  0) >= (typeCount["Xỉu"]  0) ? "Tài" : "Xỉu";
  return {
    tai_count: typeCount["Tài"] || 0,
    xiu_count: typeCount["Xỉu"] || 0,
    most_common_total: Number(mostCommonTotal),
    most_common_type: mostCommonType
  };
}

function rule_special_pattern(last4) {
  if (last4[0] === last4[2] && last4[0] === last4[3] && last4[0] !== last4[1]) {
    return { prediction: "Tài", confidence: 85, reason: Cầu đặc biệt ${last4}. Bắt Tài theo công thức đặc biệt. };
  }
}
function rule_sandwich(last3, lastResult) {
  if (last3[0] === last3[2] && last3[0] !== last3[1]) {
    return { prediction: lastResult === "Tài" ? "Xỉu" : "Tài", confidence: 83, reason: Cầu sandwich ${last3}. Bẻ cầu! };
  }
}
function rule_special_numbers(last3, lastResult) {
  const special = [7, 9, 10];
  const count = last3.filter(t => special.includes(t)).length;
  if (count >= 2) {
    return { prediction: lastResult === "Tài" ? "Xỉu" : "Tài", confidence: 81, reason: Xuất hiện ≥2 số đặc biệt ${special}. Bẻ cầu! };
  }
}
function rule_frequent_repeat(last6, lastTotal) {
  const freq = last6.filter(t => t === lastTotal).length;
  if (freq >= 3) {
    return { prediction: getTaiXiu(lastTotal), confidence: 80, reason: Số ${lastTotal} lặp lại ${freq} lần. Bắt theo nghiêng cầu! };
  }
}
function rule_repeat_pattern(last3, lastResult) {
  if (last3[0] === last3[2] || last3[1] === last3[2]) {
    return { prediction: lastResult === "Tài" ? "Xỉu" : "Tài", confidence: 77, reason: Cầu lặp dạng ${last3}. Bẻ cầu theo dạng A-B-B hoặc A-B-A. };
  }
}
function rule_default(lastResult) {
  return { prediction: lastResult === "Tài" ? "Xỉu" : "Tài", confidence: 71, reason: "Không có cầu đặc biệt nào, bẻ cầu mặc định theo 1-1." };
}

function duDoanSunwin200kVip(totalsList) {
  if (totalsList.length < 4) {
    return { prediction: "Chờ", confidence: 0, reason: "Chưa đủ dữ liệu, cần ít nhất 4 phiên.", history_summary: taiXiuStats(totalsList) };
  }
  const last4 = totalsList.slice(-4);
  const last3 = totalsList.slice(-3);
  const last6 = totalsList.slice(-6);
  const lastTotal = totalsList[totalsList.length - 1];
  const lastResult = getTaiXiu(lastTotal);

  const rules = [
    () => rule_special_pattern(last4),
    () => rule_sandwich(last3, lastResult),
    () => rule_special_numbers(last3, lastResult),
    () => rule_frequent_repeat(last6, lastTotal),
    () => rule_repeat_pattern(last3, lastResult)
  ];

  for (let rule of rules) {
    const result = rule();
    if (result) {
      result.history_summary = taiXiuStats(totalsList);
      return result;
    }
  }
  const result = rule_default(lastResult);
  result.history_summary = taiXiuStats(totalsList);
  return result;
}

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.atpman.net/websocket");

  ws.on("open", () => {
    console.log("✅ Đã kết nối WebSocket");
    const authPayload = [1, "MiniGame", "banohu1", "ba2007ok", {
      info: "{"ipAddress":"2a09:bac5:d46e:18be::277:9a","userId":"daf3a573-8ac5-4db4-9717-256b848044af","username":"S8_miss88","timestamp":1750747055128,"refreshToken":"token"}",
      signature: "signature"
    }];
    ws.send(JSON.stringify(authPayload));

    setTimeout(() => {
      ws.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 2000 }]));
    }, 2000);
  });

ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        lastResults = json[1].htr.map(item => ({ sid: item.sid, d1: item.d1, d2: item.d2, d3: item.d3 }));
        const latest = lastResults[0];
        const total = latest.d1 + latest.d2 + latest.d3;
        currentResult = getTaiXiu(total);
        currentSession = latest.sid;
        console.log(📥 Phiên ${currentSession}: ${latest.d1} + ${latest.d2} + ${latest.d3} = ${total} → ${currentResult});
      }
    } catch {}
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket bị đóng, thử kết nối lại sau 5 giây...");
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/club789", async (req, reply) => {
  const validResults = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (validResults.length < 1) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu để dự đoán",
      used_pattern: ""
    };
  }
  const totals = validResults.map(r => r.d1 + r.d2 + r.d3);
  const last = validResults[0];
  const total = last.d1 + last.d2 + last.d3;
  const result = getTaiXiu(total);
  const predictionData = duDoanSunwin200kVip(totals);
  const pattern = validResults.slice(0, 6).map(r => getTaiXiu(r.d1 + r.d2 + r.d3)[0]).reverse().join("");

  return {
    current_result: result,
    current_session: last.sid,
    next_session: last.sid + 1,
    prediction: predictionData.prediction,
    confidence: predictionData.confidence,
    reason: predictionData.reason,
    used_pattern: pattern,
    history_summary: predictionData.history_summary
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(🚀 Server đang chạy tại ${address});
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
