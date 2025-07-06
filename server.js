const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = "AIzaSyC-aNjKTQ2XVaM3LPUWLjQtB67m5VXO58o"; // Please be cautious with hardcoding API keys in production

let lastResults = [];
let ws = null;
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
    console.log("✅ WebSocket đã kết nối");

    const authPayload = [
      1,
      "MiniGame",
      "SC_xigtupou",
      "conga999",
      {
        info: "{\"ipAddress\":\"2001:ee0:4f91:2000:49ad:34c3:87af:91bd\",\"userId\":\"eff718a2-31db-4dd5-acb5-41f8cfd3e486\",\"username\":\"SC_miss88\",\"timestamp\":1751339136811,\"refreshToken\":\"22aadcb93490422b8d713f8776329a48.9adf6a5293d8443a888edd3ee802b9f4\"}",
        signature: "1CC2919566B000AA9A5D184382B983232798F1AE0D0684F2B60148B88ADEF951F43494503E97981EB96275E4597D93208029C516F77066242A5E549C902B21FF8AB326300FDCBE1876D2591AA4C8709C2C2CA59F058E92D666F5B6B2FD8A7DD9A7C519AE6EB3CBFA9D80432DECFE3A978C3DDBE77D9D0FB62E222E873A42F780"
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
    } catch (e) {
      console.error("❌ JSON parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đóng. Thử lại sau 5s...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, 5000);
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/axocuto", async (request, reply) => {
  const results = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (results.length < 3) {
    return { error: "Không đủ dữ liệu để phân tích" };
  }

  const getResult = (d1, d2, d3) => (d1 + d2 + d3 >= 11 ? "Tài" : "Xỉu");
  const latest = results[0];
  const patternArr = results.slice(0, 3).map(r => getResult(r.d1, r.d2, r.d3));
  const patternStr = patternArr.join(" - ");

  // This prompt aims to get a response similar to the image's gemini_response
  const prompt = `Dựa trên pattern gần đây nhất là "${patternStr}".
Hãy đưa ra dự đoán về kết quả của phiên tiếp theo (Tài hoặc Xỉu) và giải thích chi tiết lý do.
Cấu trúc phản hồi nên bao gồm:
Dự đoán: [Tài/Xỉu]
Lý do:
1. Phân tích xu hướng từ pattern [patternStr]: [giải thích xu hướng và khả năng đảo ngược nếu có]
2. Xác định loại cầu đang xuất hiện: [Phân loại cầu, ví dụ: cầu hỗn hợp, cầu bệt, cầu 1-1, v.v. hoặc nếu khó xác định với dữ liệu ngắn]
3. Dự đoán phiên tiếp theo dựa trên quy luật thống kê: [lý do dựa trên thống kê hoặc khả năng đảo ngược]
Độ tin cậy: [phần trăm, ví dụ: 85%]` // Added confidence to the prompt

  let geminiText = "";
  let extractedPrediction = "Không xác định"; // Default prediction
  let extractedConfidence = "0%"; // Default confidence

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await res.json();
    geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi từ AI";

    // Attempt to parse prediction and confidence from geminiText
    const predictionMatch = geminiText.match(/Dự đoán:\s*(Tài|Xỉu)/);
    if (predictionMatch && predictionMatch[1]) {
      extractedPrediction = predictionMatch[1];
    } else if (geminiText.includes("Xỉu")) { // Fallback if explicit "Dự đoán:" isn't found
      extractedPrediction = "Xỉu";
    } else if (geminiText.includes("Tài")) {
      extractedPrediction = "Tài";
    }

    const confidenceMatch = geminiText.match(/Độ tin cậy:\s*(\d+)%/);
    if (confidenceMatch && confidenceMatch[1]) {
      extractedConfidence = confidenceMatch[1] + "%";
    }

  } catch (err) {
    geminiText = "Lỗi khi gọi AI Gemini: " + err.message;
    console.error("Lỗi khi gọi AI Gemini:", err);
  }

  // Extract the reason and pattern type from geminiText for the ai_analysis field
  // This is a basic extraction and might need more robust parsing depending on AI's varied output.
  let aiReason = "";
  let aiPatternType = "**Đang xuất hiện:** Với dữ liệu ngắn như vậy, rất khó để xác định một loại cầu cụ thể. Có thể xem đây là cầu hỗn hợp, hoặc một đoạn cầu bị gián đoạn."; // Default from image

  const reasonMatch = geminiText.match(/Lý do:\s*([\s\S]*?)(?=Độ tin cậy:|$)/);
  if (reasonMatch && reasonMatch[1]) {
      aiReason = reasonMatch[1].trim();
      // Try to refine pattern_type from reason
      const patternTypeInReason = aiReason.match(/Xác định loại cầu đang xuất hiện:\s*(.*)/);
      if (patternTypeInReason && patternTypeInReason[1]) {
          aiPatternType = patternTypeInReason[1].trim();
      }
  }


  return {
    current_result: getResult(latest.d1, latest.d2, latest.d3),
    current_session: latest.sid,
    next_session: latest.sid + 1,
    prediction: extractedPrediction, // Use extracted prediction from AI
    used_pattern: "AI Gemini Pro",
    pattern: `Pattern ${patternStr} - Phân tích bằng AI Gemini`,
    ai_analysis: {
      reason: aiReason, // Populate reason from AI response
      pattern_type: aiPatternType, // Populate pattern_type from AI response or keep default
      confidence: extractedConfidence // Populate confidence from AI response
    },
    gemini_response: geminiText // Full AI response
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server Fastify chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
