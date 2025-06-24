
// ==== SUNWIN TÀI XỈU - DỰ ĐOÁN CAO CẤP ====
const Fastify = require("fastify");
const WebSocket = require("ws");
const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3003;

let hitResults = [];
let hitWS = null;
let hitInterval = null;

function getTaiXiu(total) {
  return total >= 11 ? "Tài" : "Xỉu";
}

function taiXiuStats(totalsList) {
  const types = totalsList.map(getTaiXiu);
  const count = types.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const mostCommonTotal = totalsList.sort((a,b,
    _=>(b_=totalsList.filter(v=>v==b).length)-(a_=totalsList.filter(v=>v==a).length)) => b_ - a_)[0];
  const mostCommonType = (count["Tài"] || 0) >= (count["Xỉu"] || 0) ? "Tài" : "Xỉu";
  return {
    tai_count: count["Tài"] || 0,
    xiu_count: count["Xỉu"] || 0,
    most_common_total: mostCommonTotal,
    most_common_type: mostCommonType
  };
}

function ruleSpecialPattern(last4) {
  if (last4[0] === last4[2] && last4[0] === last4[3] && last4[0] !== last4[1]) {
    return {
      prediction: "Tài",
      confidence: 85,
      reason: `Cầu đặc biệt ${last4}. Bắt Tài theo công thức đặc biệt.`
    };
  }
}

function ruleSandwich(last3, lastResult) {
  if (last3[0] === last3[2] && last3[0] !== last3[1]) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 83,
      reason: `Cầu sandwich ${last3}. Bẻ cầu!`
    };
  }
}

function ruleSpecialNumbers(last3, lastResult) {
  const specialNums = new Set([7, 9, 10]);
  const count = last3.filter(t => specialNums.has(t)).length;
  if (count >= 2) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 81,
      reason: `Xuất hiện ≥2 số đặc biệt ${[...specialNums]} gần nhất. Bẻ cầu!`
    };
  }
}

function ruleFrequentRepeat(last6, lastTotal) {
  const freq = last6.filter(t => t === lastTotal).length;
  if (freq >= 3) {
    return {
      prediction: getTaiXiu(lastTotal),
      confidence: 80,
      reason: `Số ${lastTotal} lặp lại ${freq} lần. Bắt theo nghiêng cầu!`
    };
  }
}

function ruleRepeatPattern(last3, lastResult) {
  if (last3[0] === last3[2] || last3[1] === last3[2]) {
    return {
      prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
      confidence: 77,
      reason: `Cầu lặp dạng ${last3}. Bẻ cầu theo dạng A-B-B hoặc A-B-A.`
    };
  }
}

function ruleDefault(lastResult) {
  return {
    prediction: lastResult === "Tài" ? "Xỉu" : "Tài",
    confidence: 71,
    reason: "Không có cầu đặc biệt nào, bẻ cầu mặc định theo 1-1."
  };
}

function duDoanSunwin200kVip(totalsList) {
  if (totalsList.length < 4) {
    return {
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu, cần ít nhất 4 phiên.",
      history_summary: taiXiuStats(totalsList)
    };
  }

  const last4 = totalsList.slice(-4);
  const last3 = totalsList.slice(-3);
  const last6 = totalsList.slice(-6);
  const lastTotal = totalsList[totalsList.length - 1];
  const lastResult = getTaiXiu(lastTotal);

  const rules = [
    () => ruleSpecialPattern(last4),
    () => ruleSandwich(last3, lastResult),
    () => ruleSpecialNumbers(last3, lastResult),
    () => ruleFrequentRepeat(last6, lastTotal),
    () => ruleRepeatPattern(last3, lastResult),
  ];

  for (const rule of rules) {
    const result = rule();
    if (result) {
      result.history_summary = taiXiuStats(totalsList);
      return result;
    }
  }

  const result = ruleDefault(lastResult);
  result.history_summary = taiXiuStats(totalsList);
  return result;
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
        accessToken: "1-57106ebb5604b604753fc5edaf8478df",
        reconnect: true,
      },
    ];
    hitWS.send(JSON.stringify(authPayload));

    clearInterval(hitInterval);
    hitInterval = setInterval(() => {
      const taiXiuPayload = [
        6,
        "MiniGame",
        "taixiuPlugin",
        { cmd: 1005 },
      ];
      hitWS.send(JSON.stringify(taiXiuPayload));
    }, 5000);
  });

  hitWS.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json) && json[1]?.htr) {
        hitResults = json[1].htr.map((item) => ({
          sid: item.sid,
          d1: item.d1,
          d2: item.d2,
          d3: item.d3,
        }));
      }
    } catch (e) {}
  });

  hitWS.on("close", () => {
    clearInterval(hitInterval);
    setTimeout(connectHitWebSocket, 5000);
  });

  hitWS.on("error", () => {
    hitWS.close();
  });
}

connectHitWebSocket();

fastify.get("/api/hit", async (request, reply) => {
  const validResults = [...hitResults]
    .reverse()
    .filter((item) => item.d1 && item.d2 && item.d3);

  if (validResults.length < 4) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: "Chờ",
      confidence: 0,
      reason: "Chưa đủ dữ liệu để dự đoán",
      used_pattern: {},
    };
  }

  const totalsList = validResults.map((item) => item.d1 + item.d2 + item.d3);
  const current = validResults[0];
  const total = totalsList[totalsList.length - 1];
  const result = getTaiXiu(total);
  const currentSession = current.sid;
  const nextSession = currentSession + 1;
  const predictionData = duDoanSunwin200kVip(totalsList);

  return {
    current_result: result,
    current_session: currentSession,
    next_session: nextSession,
    prediction: predictionData.prediction,
    confidence: predictionData.confidence,
    reason: predictionData.reason,
    used_pattern: predictionData.history_summary,
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Fastify server đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
      
