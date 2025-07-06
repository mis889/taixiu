const Fastify = require("fastify");
const WebSocket = require("ws");
const fetch = require("node-fetch"); // Đảm bảo bạn đã cài đặt: npm install node-fetch

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = "AIzaSyC-aNjKTQ2XVaM3LPUWLjQtB67m5VXO58o"; // !!! Cảnh báo: KHÔNG hardcode API Key trong môi trường Production. Hãy sử dụng biến môi trường.

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

    // Payload xác thực này có vẻ chứa thông tin nhạy cảm (tokens, IPs).
    // Đảm bảo bạn hiểu rõ mục đích và cách sử dụng của nó.
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
    intervalCmd = setInterval(sendCmd1005, 5000); // Gửi cmd 1005 mỗi 5 giây để lấy dữ liệu mới
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
        // console.log("Dữ liệu lịch sử nhận được:", lastResults); // Để debug
      }
    } catch (e) {
      console.error("❌ Lỗi khi parse JSON từ WebSocket:", e.message);
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
  // Lấy 3 kết quả gần nhất và đảo ngược để có thứ tự từ cũ đến mới
  const results = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);
  if (results.length < 3) {
    return {
      current_result: results.length > 0 ? (results[0].d1 + results[0].d2 + results[0].d3 >= 11 ? "Tài" : "Xỉu") : "N/A",
      current_session: results.length > 0 ? results[0].sid : "N/A",
      next_session: results.length > 0 ? results[0].sid + 1 : "N/A",
      prediction: "Không đủ dữ liệu",
      used_pattern: "AI Gemini Pro",
      pattern: "Không đủ dữ liệu để phân tích",
      ai_analysis: {
        reason: "Cần ít nhất 3 phiên để phân tích.",
        pattern_type: "N/A",
        confidence: "0%"
      },
      gemini_response: "Không đủ dữ liệu lịch sử để gửi đến AI Gemini."
    };
  }

  const getResult = (d1, d2, d3) => (d1 + d2 + d3 >= 11 ? "Tài" : "Xỉu");
  const latest = results[0]; // Phiên mới nhất
  // Lấy 3 phiên gần nhất cho pattern (index 0, 1, 2 của mảng đã đảo ngược)
  const patternArr = results.slice(0, 3).map(r => getResult(r.d1, r.d2, r.d3));
  const patternStr = patternArr.join(" - "); // Ví dụ: "Tài - Xỉu - Tài"

  // Cải thiện Prompt để AI hiểu rõ hơn và trả về định dạng JSON
  const prompt = `Bạn là một chuyên gia phân tích game Tài Xỉu (Sic Bo). Trong game này, tổng điểm của 3 viên xúc xắc từ 3 đến 10 là "Xỉu", và từ 11 đến 18 là "Tài".

Dựa trên lịch sử các kết quả gần đây nhất: "${patternStr}".

Hãy phân tích xu hướng của các kết quả này, xác định loại cầu đang xuất hiện (ví dụ: cầu bệt Tài, cầu bệt Xỉu, cầu 1-1, cầu 2-1-2, cầu đảo, cầu hỗn hợp hoặc cầu không rõ ràng).
Sau đó, đưa ra dự đoán kết quả của phiên tiếp theo (chỉ là "Tài" hoặc "Xỉu").
Cuối cùng, giải thích **chi tiết** lý do cho dự đoán của bạn, căn cứ vào pattern đã cho và các quy luật/xu hướng mà bạn nhận thấy.

Vui lòng trả lời bằng tiếng Việt và theo định dạng JSON sau để dễ dàng xử lý:
{
  "prediction": "Tài", // Hoặc "Xỉu" - chỉ một trong hai giá trị này
  "reason": "Đây là lý do chi tiết cho dự đoán của tôi. [Phân tích xu hướng từ pattern]. [Xác định loại cầu đang xuất hiện]. [Dự đoán dựa trên quy luật thống kê hoặc khả năng đảo ngược nếu có]."
  "pattern_type_identified": "Cầu 1-1", // Ví dụ: "Cầu hỗn hợp", "Cầu bệt Tài", "Cầu 2-1-2", "Cầu không rõ ràng"
  "confidence_percentage": 85 // Giá trị số nguyên từ 0 đến 100
}
Nếu bạn không thể đưa ra dự đoán chắc chắn, hãy đặt confidence_percentage là 0 và prediction là "Không xác định".`;

  let geminiText = "Không có phản hồi từ AI";
  let extractedPrediction = "Không xác định";
  let extractedReason = "";
  let extractedPatternType = "**Đang xuất hiện:** Với dữ liệu ngắn như vậy, rất khó để xác định một loại cầu cụ thể. Có thể xem đây là cầu hỗn hợp, hoặc một đoạn cầu bị gián đoạn."; // Default from image
  let extractedConfidence = "0%";

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [ // Có thể thêm safety settings để tránh nội dung không mong muốn
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
      })
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`❌ Lỗi HTTP từ AI Gemini: ${res.status} ${res.statusText}. Chi tiết: ${errorBody}`);
        geminiText = `Lỗi từ AI Gemini: ${res.status} ${res.statusText}.`;
    } else {
        const data = await res.json();
        // console.log("Phản hồi nguyên thủy từ AI Gemini:", JSON.stringify(data, null, 2)); // Để debug phản hồi của AI

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawGeminiResponse = data.candidates[0].content.parts[0].text;
            geminiText = rawGeminiResponse; // Lưu phản hồi thô của AI vào geminiText

            try {
                // Cố gắng parse JSON từ phản hồi của AI
                const parsedAI = JSON.parse(rawGeminiResponse);

                if (parsedAI.prediction) {
                    extractedPrediction = parsedAI.prediction;
                }
                if (parsedAI.reason) {
                    extractedReason = parsedAI.reason;
                }
                if (parsedAI.pattern_type_identified) {
                    extractedPatternType = parsedAI.pattern_type_identified;
                }
                if (parsedAI.confidence_percentage !== undefined) {
                    extractedConfidence = `${parsedAI.confidence_percentage}%`;
                }

            } catch (jsonParseError) {
                console.error("❌ Lỗi khi parse JSON từ phản hồi của AI. Cố gắng parse văn bản thuần túy:", jsonParseError.message);
                // Fallback nếu AI không trả về JSON hợp lệ
                const predictionMatch = rawGeminiResponse.match(/Dự đoán:\s*(Tài|Xỉu)/);
                if (predictionMatch && predictionMatch[1]) {
                    extractedPrediction = predictionMatch[1];
                } else if (rawGeminiResponse.includes("Xỉu")) {
                    extractedPrediction = "Xỉu";
                } else if (rawGeminiResponse.includes("Tài")) {
                    extractedPrediction = "Tài";
                }

                const confidenceMatch = rawGeminiResponse.match(/Độ tin cậy:\s*(\d+)%/);
                if (confidenceMatch && confidenceMatch[1]) {
                    extractedConfidence = confidenceMatch[1] + "%";
                }

                // Với reason và pattern_type khi không có JSON, cần regex phức tạp hơn hoặc chấp nhận chung chung
                // Để đơn giản, sẽ giữ nguyên default pattern_type và reason nếu không parse được JSON
            }
        } else {
            geminiText = "Phản hồi từ AI không chứa phần 'text' mong muốn.";
            console.error("Phản hồi từ AI không chứa phần 'text' mong muốn:", data);
        }
    }
  } catch (err) {
    geminiText = "Lỗi khi gọi AI Gemini: " + err.message;
    console.error("❌ Lỗi mạng hoặc lỗi không xác định khi gọi AI Gemini:", err);
  }

  return {
    current_result: getResult(latest.d1, latest.d2, latest.d3),
    current_session: latest.sid,
    next_session: latest.sid + 1,
    prediction: extractedPrediction,
    used_pattern: "AI Gemini Pro",
    pattern: `Pattern ${patternStr} - Phân tích bằng AI Gemini`,
    ai_analysis: {
      reason: extractedReason,
      pattern_type: extractedPatternType,
      confidence: extractedConfidence
    },
    gemini_response: geminiText
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server Fastify chạy tại ${address}`);
  } catch (err) {
    console.error("❌ Lỗi khởi động server Fastify:", err);
    process.exit(1);
  }
};

start();
