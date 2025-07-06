const Fastify = require("fastify");
const WebSocket = require("ws");
const fetch = require("node-fetch"); // <-- Dòng này phải có và đúng ở đây để hàm fetch được định nghĩa.

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;
// !!! Cảnh báo: KHÔNG hardcode API Key trong môi trường Production.
// Thay vào đó, hãy sử dụng biến môi trường: process.env.GEMINI_API_KEY
// Ví dụ, trên Render, bạn có thể thêm GEMINI_API_KEY vào Environment Variables.
const GEMINI_API_KEY = "AIzaSyC-aNjKTQ2XVaM3LPUWLjQtB67m5VXO58o"; 

// --- Biến toàn cục để lưu trữ dữ liệu và trạng thái WebSocket ---
let lastResults = []; // Lưu trữ các kết quả Tài Xỉu gần nhất
let ws = null;        // Đối tượng WebSocket
let intervalCmd = null; // Biến để lưu trữ ID của setInterval cho lệnh 1005

// --- Hàm gửi lệnh 1005 qua WebSocket ---
function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
    console.log("➡️ Đã gửi lệnh 1005 qua WebSocket."); // Log khi gửi lệnh
  } else {
    console.warn("⚠️ WebSocket chưa sẵn sàng để gửi lệnh 1005.");
  }
}

// --- Hàm kết nối WebSocket và quản lý sự kiện ---
function connectWebSocket() {
  console.log("🔄 Đang cố gắng kết nối WebSocket...");
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjB9.p56b5g73I9wyoVu4db679bOvVeFJWVjGDg_ulBXyav8");

  ws.on("open", () => {
    console.log("✅ WebSocket đã kết nối thành công.");

    // Payload xác thực. Đảm bảo thông tin này là hợp lệ và được quản lý an toàn.
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
    console.log("➡️ Đã gửi payload xác thực WebSocket.");

    // Xóa interval cũ nếu có và thiết lập interval mới để gửi lệnh 1005 định kỳ
    clearInterval(intervalCmd);
    intervalCmd = setInterval(sendCmd1005, 5000); 
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      // Kiểm tra xem dữ liệu có phải là kết quả lịch sử Tài Xỉu không
      if (Array.isArray(json) && json[1]?.htr) {
        lastResults = json[1].htr.map(item => ({
          sid: item.sid,
          d1: item.d1,
          d2: item.d2,
          d3: item.d3
        }));
        // console.log("✔️ Đã cập nhật dữ liệu lịch sử từ WebSocket:", lastResults.length, "phiên."); // Để debug
      }
    } catch (e) {
      console.error("❌ Lỗi khi parse JSON từ tin nhắn WebSocket:", e.message, "Dữ liệu:", data.toString().substring(0, 100) + "...");
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket đã đóng. Thử lại sau 5 giây...");
    clearInterval(intervalCmd); // Xóa interval khi đóng kết nối
    setTimeout(connectWebSocket, 5000); // Thử kết nối lại sau 5 giây
  });

  ws.on("error", (err) => {
    console.error("❌ Lỗi WebSocket:", err.message);
    ws.close(); // Đóng kết nối để kích hoạt sự kiện 'close' và thử lại
  });
}

// --- Khởi tạo kết nối WebSocket khi ứng dụng bắt đầu ---
connectWebSocket();

// --- Endpoint API cho dự đoán Tài Xỉu ---
fastify.get("/api/axocuto", async (request, reply) => {
  // Lấy 3 kết quả gần nhất, đảo ngược để có thứ tự từ cũ đến mới, và lọc bỏ kết quả thiếu dữ liệu
  const results = [...lastResults].reverse().filter(r => r.d1 && r.d2 && r.d3);

  if (results.length < 3) {
    console.warn("❗ Không đủ dữ liệu lịch sử để phân tích (cần ít nhất 3 phiên).");
    return {
      current_result: results.length > 0 ? (results[0].d1 + results[0].d2 + results[0].d3 >= 11 ? "Tài" : "Xỉu") : "N/A",
      current_session: results.length > 0 ? results[0].sid : "N/A",
      next_session: results.length > 0 ? results[0].sid + 1 : "N/A",
      prediction: "Không đủ dữ liệu",
      used_pattern: "AI Gemini Pro",
      pattern: "Không đủ dữ liệu để phân tích",
      ai_analysis: {
        reason: "Cần ít nhất 3 phiên để AI phân tích.",
        pattern_type: "N/A",
        confidence: "0%"
      },
      gemini_response: "Không đủ dữ liệu lịch sử (chỉ có " + results.length + " phiên) để gửi đến AI Gemini."
    };
  }

  // Hàm helper để xác định kết quả Tài/Xỉu
  const getResult = (d1, d2, d3) => (d1 + d2 + d3 >= 11 ? "Tài" : "Xỉu");

  const latest = results[0]; // Phiên mới nhất (đầu tiên sau khi đảo ngược)
  // Lấy 3 phiên gần nhất để tạo pattern chuỗi (ví dụ: "Tài - Xỉu - Tài")
  const patternArr = results.slice(0, 3).map(r => getResult(r.d1, r.d2, r.d3));
  const patternStr = patternArr.join(" - "); 

  // --- Tạo Prompt cho AI Gemini ---
  const prompt = `Bạn là một chuyên gia phân tích game Tài Xỉu (Sic Bo). Trong game này, tổng điểm của 3 viên xúc xắc từ 3 đến 10 là "Xỉu", và từ 11 đến 18 là "Tài".

Dựa trên lịch sử các kết quả gần đây nhất: "${patternStr}".

Hãy phân tích xu hướng của các kết quả này, xác định loại cầu đang xuất hiện (ví dụ: cầu bệt Tài, cầu bệt Xỉu, cầu 1-1, cầu 2-1-2, cầu đảo, cầu hỗn hợp hoặc cầu không rõ ràng).
Sau đó, đưa ra dự đoán kết quả của phiên tiếp theo (chỉ là "Tài" hoặc "Xỉu").
Cuối cùng, giải thích **chi tiết** lý do cho dự đoán của bạn, căn cứ vào pattern đã cho và các quy luật/xu hướng mà bạn nhận thấy.

Vui lòng trả lời bằng tiếng Việt và **theo đúng định dạng JSON** sau để dễ dàng xử lý. **Đảm bảo toàn bộ phản hồi là một chuỗi JSON hợp lệ, không có văn bản thừa bên ngoài JSON.**
\`\`\`json
{
  "prediction": "Tài", // Hoặc "Xỉu" - chỉ một trong hai giá trị này
  "reason": "Đây là lý do chi tiết cho dự đoán của tôi. [Phân tích xu hướng từ pattern]. [Xác định loại cầu đang xuất hiện]. [Dự đoán dựa trên quy luật thống kê hoặc khả năng đảo ngược nếu có]."
  "pattern_type_identified": "Cầu 1-1", // Ví dụ: "Cầu hỗn hợp", "Cầu bệt Tài", "Cầu 2-1-2", "Cầu không rõ ràng"
  "confidence_percentage": 85 // Giá trị số nguyên từ 0 đến 100
}
\`\`\`
Nếu bạn không thể đưa ra dự đoán chắc chắn, hãy đặt "prediction": "Không xác định" và "confidence_percentage": 0.`;

  let geminiText = "Không có phản hồi từ AI";
  let extractedPrediction = "Không xác định";
  let extractedReason = "";
  let extractedPatternType = "**Đang xuất hiện:** Với dữ liệu ngắn như vậy, rất khó để xác định một loại cầu cụ thể. Có thể xem đây là cầu hỗn hợp, hoặc một đoạn cầu bị gián đoạn."; // Giá trị mặc định như ảnh chụp màn hình ban đầu
  let extractedConfidence = "0%";

  try {
    console.log("➡️ Đang gọi API Gemini...");
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
        // Xử lý lỗi HTTP (ví dụ: 401 Unauthorized, 403 Forbidden, 500 Server Error)
        const errorBody = await res.text();
        console.error(`❌ Lỗi HTTP từ AI Gemini: ${res.status} ${res.statusText}. Chi tiết phản hồi lỗi: ${errorBody}`);
        geminiText = `Lỗi từ AI Gemini: ${res.status} ${res.statusText}. Chi tiết: ${errorBody.substring(0, 200)}. Vui lòng kiểm tra API Key hoặc giới hạn truy cập.`;
    } else {
        const data = await res.json();
        // Console.log toàn bộ phản hồi của AI để debug cấu trúc nếu có vấn đề
        // console.log("Phản hồi nguyên thủy từ AI Gemini (JSON):", JSON.stringify(data, null, 2)); 

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawGeminiResponse = data.candidates[0].content.parts[0].text;
            geminiText = rawGeminiResponse; // Lưu phản hồi thô của AI vào geminiText

            try {
                // Cố gắng parse JSON từ phản hồi của AI
                // Đôi khi AI có thể trả về JSON trong một khối markdown, nên cần loại bỏ ```json và ```
                const jsonString = rawGeminiResponse.replace(/```json\n?|\n?```/g, '').trim();
                const parsedAI = JSON.parse(jsonString);

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
                console.log("✅ Đã parse JSON từ AI Gemini thành công.");

            } catch (jsonParseError) {
                console.error("❌ Lỗi khi parse JSON từ phản hồi của AI. Có thể AI không trả về JSON hợp lệ hoặc có văn bản thừa. Cố gắng parse văn bản thuần túy:", jsonParseError.message);
                // Fallback: Nếu AI không trả về JSON hợp lệ, cố gắng parse từ văn bản thuần túy (ít đáng tin cậy hơn)
                const predictionMatch = rawGeminiResponse.match(/Dự đoán:\s*(Tài|Xỉu)/);
                if (predictionMatch && predictionMatch[1]) {
                    extractedPrediction = predictionMatch[1];
                } else if (rawGeminiResponse.includes("Xỉu")) { // Fallback bổ sung
                    extractedPrediction = "Xỉu";
                } else if (rawGeminiResponse.includes("Tài")) { // Fallback bổ sung
                    extractedPrediction = "Tài";
                }

                const confidenceMatch = rawGeminiResponse.match(/Độ tin cậy:\s*(\d+)%/);
                if (confidenceMatch && confidenceMatch[1]) {
                    extractedConfidence = confidenceMatch[1] + "%";
                }

                // Đối với 'reason' và 'pattern_type' khi không có JSON, sẽ khó trích xuất chính xác.
                // Các giá trị mặc định đã khai báo sẽ được giữ nguyên.
            }
        } else {
            geminiText = "Phản hồi từ AI không chứa phần 'text' mong muốn (có thể do safety settings chặn hoặc lỗi nội bộ của AI).";
            console.error("❗ Phản hồi từ AI không chứa phần 'text' mong muốn. Cấu trúc data:", JSON.stringify(data, null, 2));
        }
    }
  } catch (err) {
    geminiText = "Lỗi khi gọi AI Gemini: " + err.message;
    console.error("❌ Lỗi mạng hoặc lỗi không xác định khi gọi AI Gemini (ví dụ: 'fetch is not a function'):", err);
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
    gemini_response: geminiText // Phản hồi đầy đủ từ AI Gemini
  };
});

// --- Khởi động máy chủ Fastify ---
const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server Fastify chạy tại ${address}`);
  } catch (err) {
    console.error("❌ Lỗi khởi động server Fastify:", err);
    process.exit(1); // Thoát ứng dụng nếu server không thể khởi động
  }
};

start();
