// server.js
const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

let lastResults = [];
let ws = null;
let reconnectInterval = 5000;
let intervalCmd = null;

function getTaiXiu(total) {
  return total >= 11 ? "Tài" : "Xỉu";
}

function taiXiuStats(totals) {
  if (totals.length === 0) {
    return {
      tai_count: 0,
      xiu_count: 0,
      most_common_total: null,
      most_common_type: null
    };
  }

  const types = totals.map(getTaiXiu);
  const count = { "Tài": 0, "Xỉu": 0 };
  types.forEach(type => count[type]++);
  const totalFreq = {};
  totals.forEach(t => totalFreq[t] = (totalFreq[t] || 0) + 1);
  const most_common_total = Object.entries(totalFreq).reduce((a, b) => a[1] > b[1] ? a : b)[0];

  return {
    tai_count: count["Tài"],
    xiu_count: count["Xỉu"],
    most_common_total: Number(most_common_total),
    most_common_type: count["Tài"] >= count["Xỉu"] ? "Tài" : "Xỉu"
  };
}

function rule_special_pattern(last4) {
  if (last4[0] === last4[2] && last4[0] === last4[3] && last4[0] !== last4[1]) {
    return {
      prediction: "Tài",
      confidence: 85,
      reason: `Cầu đặc biệt ${last4.join("-")}. Bắt Tài theo công thức đặc biệt.`
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
  const count = last3.filter(x => special.includes(x)).length;
  if (count >= 2) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 81,
      reason: `≥2 số đặc biệt [7,9,10] gần nhất (${last3}). Bẻ cầu!`
    };
  }
}

function rule_frequent_repeat(last6, lastTotal) {
  const freq = last6.filter(x => x === lastTotal).length;
  if (freq >= 3) {
    return {
      prediction: getTaiXiu(lastTotal),
      confidence: 80,
      reason: `Số ${lastTotal} lặp lại ${freq} lần. Bắt theo nghiêng cầu.`
    };
  }
}

function rule_repeat_pattern(last3, lastResult) {
  if (last3[0] === last3[2] || last3[1] === last3[2]) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 77,
      reason: `Cầu lặp ${last3.join("-")}. Bẻ cầu dạng A-B-B hoặc A-B-A.`
    };
  }
}

function rule_default(lastResult) {
  return {
    prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
    confidence: 71,
    reason: "Không có cầu đặc biệt. Bẻ cầu mặc định theo 1-1."
  };
}

function duDoan(totals) {
  if (totals.length < 4) {
    return {
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu",
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

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjB9.p56b5g73I9wyoVu4db679bOvVeFJWVjGDg_ulBXyav8");

  ws.on("open", () => {
    console.log("✅ WebSocket đã kết nối");
    const authPayload = [
      1, "MiniGame", "SC_xigtupou", "conga999",
      { info: "fake-info", signature: "fake-signature" }
    ];
    ws.send(JSON.stringify(authPayload));
    clearInterval(intervalCmd);
    intervalCmd = setInterval(() => {
      const cmd = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
      ws.send(JSON.stringify(cmd));
    }, 5000);
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        lastResults = json[1].htr.map(item => ({
          sid: item.sid,
          total: item.d1 + item.d2 + item.d3
        }));
        console.log("Đã nhận được:", lastResults.length, "kết quả");
      }
    } catch (e) {
      console.error("Lỗi xử lý message:", e);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket bị đóng, đang thử lại...");
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", () => ws.close());
}

connectWebSocket();

fastify.get("/api/taixiu", async () => {
  const valid = [...lastResults].reverse().map(r => r.total).filter(Boolean);
  const pattern = valid.length >= 1 ? valid.slice(0, 13).map(getTaiXiu).join("") : "";
  const info = duDoan(valid);

  return {
    prediction: info.prediction,
    confidence: info.confidence,
    reason: info.reason,
    pattern,
    history_summary: info.history_summary
  };
});

fastify.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log("🚀 Server đang chạy tại http://localhost:" + PORT);
});
