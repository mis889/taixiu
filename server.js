const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

let lastResults = [];
let currentSession = null;

let ws = null;
let reconnectInterval = 5000;
let intervalCmd = null;

const predictionMap = {
  "TXT": "Xỉu", 
  "TTXX": "Tài", 
  "XXTXX": "Tài", 
  "TTX": "Xỉu", 
  "XTT": "Tài",
  "TXX": "Tài", 
  "XTX": "Xỉu", 
  "TXTX": "Tài", 
  "XTXX": "Tài", 
  "XXTX": "Tài",
  "TXTT": "Xỉu", 
  "TTT": "Tài", 
  "XXX": "Tài", 
  "TXXT": "Tài", 
  "XTXT": "Xỉu",
  "TXXT": "Tài", 
  "XXTT": "Tài", 
  "TTXX": "Xỉu", 
  "XTTX": "Tài", 
  "XTXTX": "Tài",
  "TTXXX": "Tài", 
  "XTTXT": "Tài", 
  "XXTXT": "Xỉu", 
  "TXTTX": "Tài", 
  "XTXXT": "Tài",
  "TTTXX": "Xỉu", 
  "XXTTT": "Tài", 
  "XTXTT": "Tài", 
  "TXTXT": "Tài", 
  "TTXTX": "Xỉu",
  "TXTTT": "Xỉu", 
  "XXTXTX": "Tài", 
  "XTXXTX": "Tài", 
  "TXTTTX": "Tài", 
  "TTTTXX": "Xỉu",
  "XTXTTX": "Tài", 
  "XTXXTT": "Tài", 
  "TXXTXX": "Tài", 
  "XXTXXT": "Tài", 
  "TXTTXX": "Xỉu",
  "TTTXTX": "Xỉu", 
  "TTXTTT": "Tài", 
  "TXXTTX": "Tài", 
  "XXTTTX": "Tài", 
  "XTTTTX": "Xỉu",
  "TXTXTT": "Tài", 
  "TXTXTX": "Tài", 
  "TTTTX": "Tài", 
  "XXXTX": "Tài", 
  "TXTTTX": "Xỉu",
  "XTXXXT": "Tài", 
  "XXTTXX": "Tài", 
  "TTTXXT": "Xỉu", 
  "XXTXXX": "Tài", 
  "XTXTXT": "Tài",
  "TTXXTX": "Tài", 
  "TTXXT": "Tài", 
  "TXXTX": "Xỉu", 
  "XTXXX": "Tài", 
  "XTXTX": "Xỉu",
  "TTXT": "Xỉu", 
  "TTTXT": "Xỉu",
  "TTTT": "Tài",
  "TTTTT": "Tài",
  "TTTTTT": "Xỉu",
  "TTTTTTT": "Tài",
  "TTTTTTX": "Xỉu",
  "TTTTTX": "Xỉu",
  "TTTTTXT": "Xỉu",
  "TTTTTXX": "Tài",
  "TTTTXT": "Xỉu",
  "TTTTXTT": "Tài",
  "TTTTXTX": "Xỉu",
  "TTTTXXT": "Xỉu",
  "TTTTXXX": "Tài",
  "TTTX": "Xỉu",
  "TTTXTT": "Tài",
  "TTTXTTT": "Xỉu",
  "TTTXTTX": "Xỉu",
  "TTTXTXT": "Tài",
  "TTTXTXX": "Tài",
  "TTTXXTT": "Tài",
  "TTTXXTX": "Tài",
  "TTTXXX": "Xỉu",
  "TTTXXXT": "Tài",
  "TTTXXXX": "Xỉu",
  "TTXTT": "Xỉu",
  "TTXTTTT": "Xỉu",
  "TTXTTTX": "Xỉu",
  "TTXTTX": "Tài",
  "TTXTTXT": "Tài",
  "TTXTTXX": "Xỉu",
  "TTXTXT": "Xỉu",
  "TTXTXTT": "Tài",
  "TTXTXTX": "Tài",
  "TTXTXX": "Xỉu",
  "TTXTXXT": "Tài",
  "TTXTXXX": "Xỉu",
  "TTXXTT": "Tài",
  "TTXXTTT": "Xỉu",
  "TTXXTTX": "Tài",
  "TTXXTXT": "Tài",
  "TTXXTXX": "Xỉu",
  "TTXXXT": "Xỉu",
  "TTXXXTT": "Tài",
  "TTXXXTX": "Tài",
  "TTXXXX": "Xỉu",
  "TTXXXXT": "Tài",
  "TTXXXXX": "Xỉu",
  "TXTTTT": "Xỉu",
  "TXTTTTT": "Xỉu",
  "TXTTTTX": "Xỉu",
  "TXTTTXT": "Xỉu",
  "TXTTTXX": "Tài",
  "TXTTXT": "Tài",
  "TXTTXTT": "Tài",
  "TXTTXTX": "Tài",
  "TXTTXXT": "Tài",
  "TXTTXXX": "Tài",
  "TXTXTTT": "Tài",
  "TXTXTTX": "Tài",
  "TXTXTXT": "Xỉu",
  "TXTXTXX": "Tài",
  "TXTXX": "Tài",
  "TXTXXT": "Tài",
  "TXTXXTT": "Tài",
  "TXTXXTX": "Xỉu",
  "TXTXXX": "Xỉu",
  "TXTXXXT": "Xỉu",
  "TXTXXXX": "Xỉu",
  "TXXTT": "Tài",
  "TXXTTT": "Tài",
  "TXXTTTT": "Tài",
  "TXXTTTX": "Tài",
  "TXXTTXT": "Xỉu",
  "TXXTTXX": "Xỉu",
  "TXXTXT": "Tài",
  "TXXTXTT": "Tài",
  "TXXTXTX": "Tài",
  "TXXTXXT": "Tài",
  "TXXTXXX": "Xỉu",
  "TXXX": "Tài",
  "TXXXT": "Tài",
  "TXXXTT": "Xỉu",
  "TXXXTTT": "Tài",
  "TXXXTTX": "Xỉu",
  "TXXXTX": "Xỉu",
  "TXXXTXT": "Tài",
  "TXXXTXX": "Xỉu",
  "TXXXX": "Xỉu",
  "TXXXXT": "Tài",
  "TXXXXTT": "Xỉu",
  "TXXXXTX": "Xỉu",
  "TXXXXX": "Tài",
  "TXXXXXT": "Xỉu",
  "TXXXXXX": "Xỉu",
  "XTTT": "Xỉu",
  "XTTTT": "Xỉu",
  "XTTTTT": "Tài",
  "XTTTTTT": "Tài",
  "XTTTTTX": "Tài",
  "XTTTTXT": "Tài",
  "XTTTTXX": "Xỉu",
  "XTTTX": "Tài",
  "XTTTXT": "Xỉu",
  "XTTTXTT": "Tài",
  "XTTTXTX": "Xỉu",
  "XTTTXX": "Tài",
  "XTTTXXT": "Tài",
  "XTTTXXX": "Tài",
  "XTTXTT": "Tài",
  "XTTXTTT": "Tài",
  "XTTXTTX": "Tài",
  "XTTXTX": "Xỉu",
  "XTTXTXT": "Tài",
  "XTTXTXX": "Xỉu",
  "XTTXX": "Xỉu",
  "XTTXXT": "Xỉu",
  "XTTXXTT": "Tài",
  "XTTXXTX": "Xỉu",
  "XTTXXX": "Tài",
  "XTTXXXT": "Xỉu",
  "XTTXXXX": "Tài",
  "XTXTTT": "Tài",
  "XTXTTTT": "Tài",
  "XTXTTTX": "Xỉu",
  "XTXTTXT": "Xỉu",
  "XTXTTXX": "Tài",
  "XTXTXTT": "Tài",
  "XTXTXTX": "Xỉu",
  "XTXTXX": "Tài",
  "XTXTXXT": "Tài",
  "XTXTXXX": "Tài",
  "XTXXTTT": "Tài",
  "XTXXTTX": "Xỉu",
  "XTXXTXT": "Tài",
  "XTXXTXX": "Tài",
  "XTXXXTT": "Xỉu",
  "XTXXXTX": "Tài",
  "XTXXXX": "Xỉu",
  "XTXXXXT": "Tài",
  "XTXXXXX": "Tài",
  "XXT": "Xỉu",
  "XXTTTT": "Tài",
  "XXTTTTT": "Xỉu",
  "XXTTTTX": "Tài",
  "XXTTTXT": "Xỉu",
  "XXTTTXX": "Xỉu",
  "XXTTX": "Tài",
  "XXTTXT": "Xỉu",
  "XXTTXTT": "Xỉu",
  "XXTTXTX": "Tài",
  "XXTTXXT": "Xỉu",
  "XXTTXXX": "Tài",
  "XXTXTT": "Tài",
  "XXTXTTT": "Tài",
  "XXTXTTX": "Xỉu",
  "XXTXTXT": "Tài",
  "XXTXTXX": "Tài",
  "XXTXXTT": "Xỉu",
  "XXTXXTX": "Xỉu",
  "XXTXXXT": "Tài",
  "XXTXXXX": "Tài",
  "XXXT": "Tài",
  "XXXTT": "Xỉu",
  "XXXTTT": "Xỉu",
  "XXXTTTT": "Xỉu",
  "XXXTTTX": "Xỉu",
  "XXXTTX": "Tài",
  "XXXTTXT": "Xỉu",
  "XXXTTXX": "Xỉu",
  "XXXTXT": "Tài",
  "XXXTXTT": "Tài",
  "XXXTXTX": "Xỉu",
  "XXXTXX": "Tài",
  "XXXTXXT": "Xỉu",
  "XXXTXXX": "Tài",
  "XXXX": "Tài",
  "XXXXT": "Xỉu",
  "XXXXTT": "Xỉu",
  "XXXXTTT": "Tài",
  "XXXXTTX": "Tài",
  "XXXXTX": "Tài",
  "XXXXTXT": "Tài",
  "XXXXTXX": "Tài",
  "XXXXX": "Tài",
  "XXXXXT": "Xỉu",
  "XXXXXTT": "Tài",
  "XXXXXTX": "Tài",
  "XXXXXX": "Tài",
  "XXXXXXT": "Tài",
  "XXXXXXX": "Tài"
};

function sendCmd1005() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    ws.send(JSON.stringify(payload));
  }
}

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/wsbinary?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXhvZGF5In0.DMD395i2WINL3cAb8YjfVcYaod9ltA2XiH8CY35vv8s");

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
        currentSession = lastResults[0]?.sid || null;
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.warn("❌ WebSocket bị đóng, thử kết nối lại...");
    clearInterval(intervalCmd);
    setTimeout(connectWebSocket, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("⚠️ Lỗi WebSocket:", err.message);
    ws.close();
  });
}

connectWebSocket();

fastify.get("/api/sunaxotool", async (request, reply) => {
  const validResults = [...lastResults]
    .reverse()
    .filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length < 2) {
    return {
      phien_cu: null,
      ket_qua: null,
      xuc_xac: null,
      tong: null,
      phien_hien_tai: null,
      du_doan: null,
      duong_cau: null
    };
  }

  const current = validResults[0];
  const prevResults = validResults.slice(1, 11);
  const tong = current.d1 + current.d2 + current.d3;
  const ket_qua = tong >= 11 ? "Tài" : "Xỉu";
  const phien_cu = current.sid;
  const phien_hien_tai = phien_cu + 1;

  // Xây pattern từ các kết quả trước
  const duong_cau = prevResults.map(r => {
    const sum = r.d1 + r.d2 + r.d3;
    return sum >= 11 ? "T" : "X";
  }).join("");

  let du_doan = predictionMap[duong_cau] || "Chờ";

  return {
    phien_cu,
    ket_qua,
    xuc_xac: [current.d1, current.d2, current.d3],
    tong,
    phien_hien_tai,
    du_doan,
    duong_cau
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Server đang chạy tại ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
