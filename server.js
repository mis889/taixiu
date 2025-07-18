const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// === Biến lưu trạng thái ===
let currentData = {
  id: "@axobantool",
  id_phien: null,
  ket_qua: "",
  pattern: ""
};
let id_phien_chua_co_kq = null;
let patternHistory = [];

// === Tin nhắn gửi WebSocket server ===
const messagesToSend = [
  [1, "MiniGame", "SC_anhlatrumapi1", "binhtool90", {
    "info": "{\"ipAddress\":\"2001:ee0:5709:2720:7ba7:fb19:d038:aa91\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsImdlbmRlciI6MCwiZGlzcGxheU5hbWUiOiJ0YW9sYWJpbmgxMjk5IiwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImJvdCI6MCwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzAyLnBuZyIsInVzZXJJZCI6IjZhNWNmN2NmLTQ0ODYtNGJlNS1hMDIzLTUyOTkyOGUyZDg1YyIsInJlZ1RpbWUiOjE3NTI3NjcyOTk2OTgsInBob25lIjoiIiwiY3VzdG9tZXJJZCI6MjgzNTEyODQ1LCJicmFuZCI6InN1bi53aW4iLCJ1c2VybmFtZSI6IlNDX2FuaGxhdHJ1bWFwaTEiLCJ0aW1lc3RhbXAiOjE3NTI3ODczMDg2NTl9.5PQjsPsm2G7SyEnAbNqXtxkxYlMQIwcJpxjh1l_hH6c\",\"userId\":\"6a5cf7cf-4486-4be5-a023-529928e2d85c\",\"username\":\"SC_anhlatrumapi1\",\"timestamp\":1752787308659}",
    "signature": "5537B01C383416D3BE734483E7A84B7CAFB9ADFE81CE55406B2D455D205F437E453989E499C153EEDDEB8614D2A347C6E0E1D7335C8C39E8555E23775C0C3B7727DD1C2DBEF76ED82122FD56C83F117C07FC3AD12300BE2207F5046BEFF0D80A979D8146BA495E6425874D46A81DEFCA11427494D22C12C0C90427873AD0BFB3"
  }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

// === Kết nối WebSocket ===
function connectWebSocket() {
  ws = new WebSocket(
    "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsImdlbmRlciI6MCwiZGlzcGxheU5hbWUiOiJ0YW9sYWJpbmgxMjk5IiwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImJvdCI6MCwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzAyLnBuZyIsInVzZXJJZCI6IjZhNWNmN2NmLTQ0ODYtNGJlNS1hMDIzLTUyOTkyOGUyZDg1YyIsInJlZ1RpbWUiOjE3NTI3NjcyOTk2OTgsInBob25lIjoiIiwiY3VzdG9tZXJJZCI6MjgzNTEyODQ1LCJicmFuZCI6InN1bi53aW4iLCJ1c2VybmFtZSI6IlNDX2FuaGxhdHJ1bWFwaTEiLCJ0aW1lc3RhbXAiOjE3NTI3ODczMDg2NTl9.5PQjsPsm2G7SyEnAbNqXtxkxYlMQIwcJpxjh1l_hH6c",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://play.sun.win"
      }
    }
  );

  ws.on('open', () => {
    console.log('[✅] Đã kết nối WebSocket');
    messagesToSend.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }, i * 600);
    });

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on('pong', () => {
    console.log('[📶] Ping OK');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (Array.isArray(data) && typeof data[1] === 'object') {
        const cmd = data[1].cmd;

        if (cmd === 1008 && data[1].sid) {
          id_phien_chua_co_kq = data[1].sid;
        }

        if (cmd === 1003 && data[1].gBB) {
          const { d1, d2, d3 } = data[1];
          const total = d1 + d2 + d3;
          const result = total <= 10 ? "Xỉu" : "Tài";

          patternHistory.push(result === "Tài" ? "T" : "X");
          if (patternHistory.length > 20) patternHistory.shift();

          currentData = {
            id: ["@axobantool", "@hatronghoann"],
            id_phien: id_phien_chua_co_kq,
            ket_qua: result,
            pattern: patternHistory.join('')
          };

          console.log(`🎲 Phiên ${id_phien_chua_co_kq}: ${d1}-${d2}-${d3} = ${total} → ${result}`);
          id_phien_chua_co_kq = null;
        }
      }
    } catch (e) {
      console.error('[❌] Lỗi xử lý:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[🔌] Mất kết nối WebSocket. Đang reconnect...');
    clearInterval(pingInterval);
    if (!isManuallyClosed) {
      reconnectTimeout = setTimeout(connectWebSocket, 2500);
    }
  });

  ws.on('error', (err) => {
    console.error('[⚠️] WebSocket lỗi:', err.message);
  });
}

// === API Express ===
app.get('/taixiu', (req, res) => {
  const { id_phien, ket_qua } = currentData;

  // Tìm d1-d2-d3 từ chuỗi pattern gần nhất
  let d1 = null, d2 = null, d3 = null, total = null;
  const match = currentData.ket_qua.match(/^(\d+)-(\d+)-(\d+)/);
  if (match) {
    d1 = parseInt(match[1]);
    d2 = parseInt(match[2]);
    d3 = parseInt(match[3]);
    total = d1 + d2 + d3;
  }

  res.json({
    id: ["@axobantool", "@hatronghoann"],
    phien: id_phien,
    Xuc_xac_1: d1,
    Xuc_xac_2: d2,
    Xuc_xac_3: d3,
    ket_qua: ket_qua // chỉ là "Tài" hoặc "Xỉu"
  });
});

app.get('/', (req, res) => {
  res.send(`<h2>🎯 SunWin Tài Xỉu</h2><p><a href="/taixiu">Xem JSON kết quả</a></p>`);
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
