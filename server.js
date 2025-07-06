const Fastify = require("fastify");
let fetch = global.fetch;
if (!fetch) fetch = require("node-fetch");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = "AIzaSyCNmonlpE6yLsY_olGUPfN1K-dvQQuQmkw";

// Dữ liệu mẫu – 6 phiên gần nhất
let lastResults = [
  { sid: 1006, d1: 4, d2: 3, d3: 5 },  // 12 -> Tài
  { sid: 1005, d1: 2, d2: 2, d3: 4 },  // 8  -> Xỉu
  { sid: 1004, d1: 6, d2: 5, d3: 1 },  // 12 -> Tài
  { sid: 1003, d1: 3, d2: 2, d3: 4 },  // 9  -> Xỉu
  { sid: 1002, d1: 5, d2: 5, d3: 2 },  // 12 -> Tài
  { sid: 1001, d1: 2, d2: 2, d3: 3 }   // 7  -> Xỉu
];

// Gọi Gemini để phân tích & dự đoán
async function getPredictionFromGemini(pattern) {
  const prompt = `
Dãy kết quả Tài Xỉu gần đây là: ${pattern.replace(/T/g, "Tài").replace(/X/g, "Xỉu")}.
Bạn là chuyên gia thống kê AI. Hãy phân tích và trả lời dưới dạng JSON chuẩn như sau:

{
  "prediction": "Tài hoặc Xỉu",
  "reason": "Lý do ngắn gọn",
  "pattern_type": "Tên mẫu nếu có",
  "confidence": "Mức độ tin tưởng (ví dụ: 90%)",
  "gemini_response": "Phân tích đầy đủ"
}
`.trim();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[^]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        prediction: parsed.prediction?.includes("Tài") ? "Tài" :
                   parsed.prediction?.includes("Xỉu") ? "Xỉu" : "Chờ",
        pattern_type: parsed.pattern_type || "Không rõ",
        ai_analysis: {
          reason: parsed.reason || "",
          confidence: parsed.confidence || "",
        },
        gemini_response: parsed.gemini_response || text
      };
    }
    return { prediction: "Chờ", pattern_type: "", ai_analysis: {}, gemini_response: text };
  } catch (e) {
    return { prediction: "Chờ", pattern_type: "", ai_analysis: {}, gemini_response: e.message };
  }
}

// API GET /api/taixiu
fastify.get("/api/taixiu", async (request, reply) => {
  const valid = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (valid.length < 6) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: "Chờ",
      used_pattern: "",
      pattern_type: "",
      ai_analysis: {},
      gemini_response: ""
    };
  }

  const current = valid[0];
  const currentSession = current.sid;
  const nextSession = current.sid + 1;

  const usedPattern = valid
    .slice(0, 6)
    .map(r => (r.d1 + r.d2 + r.d3 >= 11 ? "T" : "X"))
    .reverse()
    .join("");

  const {
    prediction,
    pattern_type,
    ai_analysis,
    gemini_response
  } = await getPredictionFromGemini(usedPattern);

  return {
    current_result: (current.d1 + current.d2 + current.d3 >= 11) ? "Tài" : "Xỉu",
    current_session: currentSession,
    next_session: nextSession,
    prediction,
    used_pattern: usedPattern,
    pattern_type,
    ai_analysis,
    gemini_response
  };
});

// Khởi động server
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server chạy tại ${address}`);
});
