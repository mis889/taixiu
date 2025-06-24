const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3010;

let b52LatestDice = null;
let b52CurrentSession = null;
let b52CurrentMD5 = null;
let b52WS = null;
let b52IntervalCmd = null;
let b52History = []; // Lưu lịch sử xúc xắc
const b52ReconnectInterval = 5000;

// === TÍNH TOÁN TÀI/XỈU ===
function getTaiXiu(total) {
  return total >= 11 ? "Tài" : "Xỉu";
}

function calcResult(d1, d2, d3) {
  const total = d1 + d2 + d3;
  return getTaiXiu(total);
}

// === DỰ ĐOÁN PHIÊN TIẾP THEO ===
function taiXiuStats(totals) {
  const typeCounts = totals.reduce((acc, t) => {
    const type = getTaiXiu(t);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const totalCounts = totals.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const mostCommonTotal = Object.entries(totalCounts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    tai_count: typeCounts["Tài"] || 0,
    xiu_count: typeCounts["Xỉu"] || 0,
    most_common_total: parseInt(mostCommonTotal),
    most_common_type: (typeCounts["Tài"] || 0) >= (typeCounts["Xỉu"] || 0) ? "Tài" : "Xỉu"
  };
}

function rule_special_pattern(last4) {
  if (last4[0] === last4[2] && last4[0] === last4[3] && last4[0] !== last4[1]) {
    return {
      prediction: "Tài",
      confidence: 85,
      reason: `Cầu đặc biệt ${last4.join("-")}. Bắt Tài theo cầu đặc biệt.`
    };
  }
}

function rule_sandwich(last3, lastResult) {
  if (last3[0] === last3[2] && last3[0] !== last3[1]) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 83,
      reason: `Cầu sandwich ${last3.join("-")}. Bẻ cầu!`
    };
  }
}

function rule_special_numbers(last3, lastResult) {
  const special = [7, 9, 10];
  const count = last3.filter(t => special.includes(t)).length;
  if (count >= 2) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 81,
      reason: `Có ≥2 số đặc biệt gần nhất (${special.join(",")}). Bẻ cầu!`
    };
  }
}

function rule_frequent_repeat(last6, lastTotal) {
  const count = last6.filter(t => t === lastTotal).length;
  if (count >= 3) {
    return {
      prediction: getTaiXiu(lastTotal),
      confidence: 80,
      reason: `Số ${lastTotal} lặp lại ${count} lần. Theo cầu lặp.`
    };
  }
}

function rule_repeat_pattern(last3, lastResult) {
  if (last3[0] === last3[2] || last3[1] === last3[2]) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 77,
      reason: `Cầu dạng A-B-A hoặc A-B-B: ${last3.join("-")}. Bẻ cầu!`
    };
  }
}

function rule_default(lastResult) {
  return {
    prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
    confidence: 71,
    reason: "Không có cầu đặc biệt nào. Bẻ cầu mặc định."
  };
}

function duDoanSunwin200kVIP(totals) {
  if (totals.length < 4) {
    return {
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu, cần ≥4 phiên.",
      history_summary: taiXiuStats(totals)
    };
  }

  const last4 = totals.slice(-4);
  const last3 = totals.slice(-3);
  const last6 = totals.slice(-6);
  const lastTotal = totals[totals.length - 1];
  const lastResult = getTaiXiu(lastTotal);

  const rules = [
    () => rule_special_pattern(last4),
    () => rule_sandwich(last3, lastResult),
    () => rule_special_numbers(last3, lastResult),
    () => rule_frequent_repeat(last6, lastTotal),
    () => rule_repeat_pattern(last3, lastResult)
  ];

  for (const rule of rules) {
    const result = rule();
    if (result) {
      result.history_summary = taiXiuStats(totals);
      return result;
    }
  }

  const result = rule_default(lastResult);
  result.history_summary = taiXiuStats(totals);
  return result;
}

// === KẾT NỐI WEBSOCKET ===
function sendB52Cmd() {
  if (b52WS && b52WS.readyState === WebSocket.OPEN) {
    b52WS.send(JSON.stringify([6, "MiniGame", "taixiuKCBPlugin", { cmd: 2000 }]));
  }
}

function connectB52WebSocket() {
  b52WS = new WebSocket("wss://minybordergs.weskb5gams.net/websocket");

  b52WS.on("open", () => {
    b52WS.send(JSON.stringify([
      1, "MiniGame", "", "", {
        agentId: "1",
        accessToken: "13-a8f8e182af0e44fa0eaceaa8595f6aa9",
        reconnect: false,
      }
    ]));
    clearInterval(b52IntervalCmd);
    b52IntervalCmd = setInterval(sendB52Cmd, 5000);
  });

  b52WS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      const message = json[1];

      if (message?.htr && Array.isArray(message.htr) && message.htr.length > 0) {
        const latest = message.htr[message.htr.length - 1];
        const session = latest?.sid;

        if (typeof latest.d1 === "number" && typeof latest.d2 === "number" && typeof latest.d3 === "number" && session && session > (b52CurrentSession || 0)) {
          b52LatestDice = { d1: latest.d1, d2: latest.d2, d3: latest.d3 };
          b52CurrentSession = session;
          b52CurrentMD5 = message.md5 || null;

          b52History = message.htr.map(item => item.d1 + item.d2 + item.d3).slice(-6);
          console.log("✅ Updated:", b52LatestDice, "Session:", session);
        }
      }
    } catch (err) {
      console.error("❌ WS Error:", err.message);
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

connectB52WebSocket();

// === API ===
fastify.get("/api/b52", async () => {
  if (!b52LatestDice || !b52CurrentSession) {
    return {
      current_dice: null,
      current_result: null,
      current_session: null,
      next_session: null,
      current_md5: null,
      used_pattern: null,
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa có dữ liệu"
    };
  }

  const dice = [b52LatestDice.d1, b52LatestDice.d2, b52LatestDice.d3];
  const total = dice.reduce((a, b) => a + b, 0);
  const current_result = getTaiXiu(total);
  const used_pattern = b52History.map(getTaiXiu).map(t => t[0]).join("");

  const predictionData = duDoanSunwin200kVIP(b52History);

  return {
    current_dice: dice,
    current_result,
    current_session: b52CurrentSession,
    next_session: b52CurrentSession + 1,
    current_md5: b52CurrentMD5,
    used_pattern,
    prediction: predictionData.prediction,
    confidence: predictionData.confidence,
    reason: predictionData.reason,
    history_summary: predictionData.history_summary
  };
});

const start = async () => {
  try {
    const addr = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log("🚀 Server chạy tại:", addr);
  } catch (err) {
    console.error("❌ Lỗi khởi chạy server:", err);
    process.exit(1);
  }
};

start();
