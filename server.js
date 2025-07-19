const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// Configuration
const PORT = process.env.PORT || 3000; // Use Render's port environment variable
const WS_URL = 'ws://160.191.243.121:3060/?id=mrtinhios&key=vantinh5907pq';
const HISTORY_MAX_LENGTH = 200;
const RECONNECT_DELAY = 5000; // 5 seconds
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Global variables
let history = [];
let currentSession = null;
let wsClient = null;
let lastActivity = Date.now();
let isShuttingDown = false;

// Keep the patternPredictions object exactly as you have it
const patternPredictions = {
  "TTT": { prediction: "Tài", confidence: 95 },
  "TTX": { prediction: "Xỉu", confidence: 85 },
  "TXT": { prediction: "Tài", confidence: 75 },
  "TXX": { prediction: "Xỉu", confidence: 80 },
  "XTT": { prediction: "Tài", confidence: 70 },
  "XTX": { prediction: "Xỉu", confidence: 65 },
  "XXT": { prediction: "Tài", confidence: 60 },
  "XXX": { prediction: "Xỉu", confidence: 90 },

  // 4-dice patterns (16 variants)
  "TTTT": { prediction: "Tài", confidence: 97 },
  "TTTX": { prediction: "Xỉu", confidence: 85 },
  "TTXT": { prediction: "Tài", confidence: 80 },
  "TTXX": { prediction: "Xỉu", confidence: 85 },
  "TXTT": { prediction: "Tài", confidence: 75 },
  "TXTX": { prediction: "Xỉu", confidence: 80 },
  "TXXT": { prediction: "Tài", confidence: 70 },
  "TXXX": { prediction: "Xỉu", confidence: 90 },
  "XTTT": { prediction: "Tài", confidence: 75 },
  "XTTX": { prediction: "Xỉu", confidence: 70 },
  "XTXT": { prediction: "Tài", confidence: 65 },
  "XTXX": { prediction: "Xỉu", confidence: 85 },
  "XXTT": { prediction: "Tài", confidence: 60 },
  "XXTX": { prediction: "Xỉu", confidence: 75 },
  "XXXT": { prediction: "Tài", confidence: 55 },
  "XXXX": { prediction: "Xỉu", confidence: 95 },

  // 5-dice patterns (32 variants) - Optimized confidence scaling
  "TTTTT": { prediction: "Tài", confidence: 98 },
  "TTTTX": { prediction: "Tài", confidence: 88 },
  "TTTXT": { prediction: "Tài", confidence: 83 },
  "TTTXX": { prediction: "Xỉu", confidence: 82 },
  "TTXTT": { prediction: "Tài", confidence: 78 },
  "TTXTX": { prediction: "Xỉu", confidence: 77 },
  "TTXXT": { prediction: "Tài", confidence: 72 },
  "TTXXX": { prediction: "Xỉu", confidence: 88 },
  "TXTTT": { prediction: "Tài", confidence: 77 },
  "TXTTX": { prediction: "Xỉu", confidence: 76 },
  "TXTXT": { prediction: "Tài", confidence: 71 },
  "TXTXX": { prediction: "Xỉu", confidence: 83 },
  "TXXTT": { prediction: "Tài", confidence: 68 },
  "TXXTX": { prediction: "Xỉu", confidence: 73 },
  "TXXXT": { prediction: "Tài", confidence: 63 },
  "TXXXX": { prediction: "Xỉu", confidence: 93 },
  "XTTTT": { prediction: "Tài", confidence: 73 },
  "XTTTX": { prediction: "Xỉu", confidence: 77 },
  "XTTXT": { prediction: "Tài", confidence: 67 },
  "XTTXX": { prediction: "Xỉu", confidence: 82 },
  "XTXTT": { prediction: "Tài", confidence: 63 },
  "XTXTX": { prediction: "Xỉu", confidence: 72 },
  "XTXXT": { prediction: "Tài", confidence: 58 },
  "XTXXX": { prediction: "Xỉu", confidence: 88 },
  "XXTTT": { prediction: "Tài", confidence: 67 },
  "XXTTX": { prediction: "Xỉu", confidence: 62 },
  "XXTXT": { prediction: "Tài", confidence: 62 },
  "XXTXX": { prediction: "Xỉu", confidence: 82 },
  "XXXTT": { prediction: "Tài", confidence: 58 },
  "XXXTX": { prediction: "Xỉu", confidence: 68 },
  "XXXXT": { prediction: "Tài", confidence: 53 },
  "XXXXX": { prediction: "Xỉu", confidence: 98 },

  // 6-dice patterns (64 variants) - Premium prediction engine
  "TTTTTT": { prediction: "Tài", confidence: 99 },
  "TTTTTX": { prediction: "Tài", confidence: 92 },
  "TTTTXT": { prediction: "Tài", confidence: 87 },
  "TTTTXX": { prediction: "Xỉu", confidence: 85 },
  "TTTXTT": { prediction: "Tài", confidence: 84 },
  "TTTXTX": { prediction: "Xỉu", confidence: 79 },
  "TTTXXT": { prediction: "Tài", confidence: 77 },
  "TTTXXX": { prediction: "Xỉu", confidence: 93 },
  "TTXTTT": { prediction: "Tài", confidence: 79 },
  "TTXTTX": { prediction: "Xỉu", confidence: 82 },
  "TTXTXT": { prediction: "Tài", confidence: 77 },
  "TTXTXX": { prediction: "Xỉu", confidence: 84 },
  "TTXXTT": { prediction: "Tài", confidence: 73 },
  "TTXXTX": { prediction: "Xỉu", confidence: 78 },
  "TTXXXT": { prediction: "Tài", confidence: 68 },
  "TTXXXX": { prediction: "Xỉu", confidence: 95 },
  "TXTTTT": { prediction: "Tài", confidence: 78 },
  "TXTTTX": { prediction: "Xỉu", confidence: 79 },
  "TXTTXT": { prediction: "Tài", confidence: 73 },
  "TXTTXX": { prediction: "Xỉu", confidence: 83 },
  "TXTXTT": { prediction: "Tài", confidence: 68 },
  "TXTXTX": { prediction: "Xỉu", confidence: 77 },
  "TXTXXT": { prediction: "Tài", confidence: 67 },
  "TXTXXX": { prediction: "Xỉu", confidence: 91 },
  "TXXTTT": { prediction: "Tài", confidence: 73 },
  "TXXTTX": { prediction: "Xỉu", confidence: 77 },
  "TXXTXT": { prediction: "Tài", confidence: 67 },
  "TXXTXX": { prediction: "Xỉu", confidence: 83 },
  "TXXXTT": { prediction: "Tài", confidence: 67 },
  "TXXXTX": { prediction: "Xỉu", confidence: 73 },
  "TXXXXT": { prediction: "Tài", confidence: 63 },
  "TXXXXX": { prediction: "Xỉu", confidence: 97 },
  "XTTTTT": { prediction: "Tài", confidence: 77 },
  "XTTTTX": { prediction: "Xỉu", confidence: 82 },
  "XTTTXT": { prediction: "Tài", confidence: 72 },
  "XTTTXX": { prediction: "Xỉu", confidence: 83 },
  "XTTXTT": { prediction: "Tài", confidence: 67 },
  "XTTXTX": { prediction: "Xỉu", confidence: 77 },
  "XTTXXT": { prediction: "Tài", confidence: 67 },
  "XTTXXX": { prediction: "Xỉu", confidence: 91 },
  "XTXTTT": { prediction: "Tài", confidence: 72 },
  "XTXTTX": { prediction: "Xỉu", confidence: 77 },
  "XTXTXT": { prediction: "Tài", confidence: 67 },
  "XTXTXX": { prediction: "Xỉu", confidence: 83 },
  "XTXXTT": { prediction: "Tài", confidence: 67 },
  "XTXXTX": { prediction: "Xỉu", confidence: 73 },
  "XTXXXT": { prediction: "Tài", confidence: 63 },
  "XTXXXX": { prediction: "Xỉu", confidence: 95 },
  "XXTTTT": { prediction: "Tài", confidence: 72 },
  "XXTTTX": { prediction: "Xỉu", confidence: 77 },
  "XXTTXT": { prediction: "Tài", confidence: 67 },
  "XXTTXX": { prediction: "Xỉu", confidence: 82 },
  "XXTXTX": { prediction: "Xỉu", confidence: 77 },
  "XXTXXT": { prediction: "Tài", confidence: 67 },
  "XXTXXX": { prediction: "Xỉu", confidence: 89 },
  "XXXTTT": { prediction: "Tài", confidence: 67 },
  "XXXTTX": { prediction: "Xỉu", confidence: 72 },
  "XXXTXT": { prediction: "Tài", confidence: 67 },
  "XXXTXX": { prediction: "Xỉu", confidence: 81 },
  "XXXXTT": { prediction: "Tài", confidence: 63 },
  "XXXXTX": { prediction: "Xỉu", confidence: 68 },
  "XXXXXT": { prediction: "Tài", confidence: 58 },
  "XXXXXX": { prediction: "Xỉu", confidence: 99 },

  // 7-dice patterns (128 variants) - VIP prediction system
  "TTTTTTT": { prediction: "Tài", confidence: 99 },
  "TTTTTTX": { prediction: "Tài", confidence: 94 },
  "TTTTTXT": { prediction: "Tài", confidence: 89 },
  "TTTTTXX": { prediction: "Xỉu", confidence: 87 },
  "TTTTXTT": { prediction: "Tài", confidence: 86 },
  "TTTTXTX": { prediction: "Xỉu", confidence: 81 },
  "TTTTXXT": { prediction: "Tài", confidence: 79 },
  "TTTTXXX": { prediction: "Xỉu", confidence: 95 },
  "TTTXTTT": { prediction: "Tài", confidence: 81 },
  "TTTXTTX": { prediction: "Xỉu", confidence: 84 },
  "TTTXTXT": { prediction: "Tài", confidence: 79 },
  "TTTXTXX": { prediction: "Xỉu", confidence: 86 },
  "TTTXXTT": { prediction: "Tài", confidence: 75 },
  "TTTXXTX": { prediction: "Xỉu", confidence: 80 },
  "TTTXXXT": { prediction: "Tài", confidence: 70 },
  "TTTXXXX": { prediction: "Xỉu", confidence: 97 },
  "TTXTTTT": { prediction: "Tài", confidence: 80 },
  "TTXTTTX": { prediction: "Xỉu", confidence: 83 },
  "TTXTTXT": { prediction: "Tài", confidence: 75 },
  "TTXTTXX": { prediction: "Xỉu", confidence: 85 },
  "TTXTXTT": { prediction: "Tài", confidence: 70 },
  "TTXTXTX": { prediction: "Xỉu", confidence: 79 },
  "TTXTXXT": { prediction: "Tài", confidence: 69 },
  "TTXTXXX": { prediction: "Xỉu", confidence: 93 },
  "TTXXTTT": { prediction: "Tài", confidence: 75 },
  "TTXXTTX": { prediction: "Xỉu", confidence: 79 },
  "TTXXTXT": { prediction: "Tài", confidence: 69 },
  "TTXXTXX": { prediction: "Xỉu", confidence: 85 },
  "TTXXXTT": { prediction: "Tài", confidence: 69 },
  "TTXXXTX": { prediction: "Xỉu", confidence: 75 },
  "TTXXXXT": { prediction: "Tài", confidence: 65 },
  "TTXXXXX": { prediction: "Xỉu", confidence: 98 },
  "TXTTTTT": { prediction: "Tài", confidence: 79 },
  "TXTTTTX": { prediction: "Xỉu", confidence: 83 },
  "TXTTTXT": { prediction: "Tài", confidence: 75 },
  "TXTTTXX": { prediction: "Xỉu", confidence: 85 },
  "TXTTXTT": { prediction: "Tài", confidence: 69 },
  "TXTTXTX": { prediction: "Xỉu", confidence: 79 },
  "TXTTXXT": { prediction: "Tài", confidence: 69 },
  "TXTTXXX": { prediction: "Xỉu", confidence: 93 },
  "TXTXTTT": { prediction: "Tài", confidence: 74 },
  "TXTXTTX": { prediction: "Xỉu", confidence: 79 },
  "TXTXTXT": { prediction: "Tài", confidence: 69 },
  "TXTXTXX": { prediction: "Xỉu", confidence: 85 },
  "TXTXXTT": { prediction: "Tài", confidence: 69 },
  "TXTXXTX": { prediction: "Xỉu", confidence: 75 },
  "TXTXXXT": { prediction: "Tài", confidence: 65 },
  "TXTXXXX": { prediction: "Xỉu", confidence: 97 },
  "TXXTTTT": { prediction: "Tài", confidence: 74 },
  "TXXTTTX": { prediction: "Xỉu", confidence: 79 },
  "TXXTTXT": { prediction: "Tài", confidence: 69 },
  "TXXTTXX": { prediction: "Xỉu", confidence: 84 },
  "TXXTXTX": { prediction: "Xỉu", confidence: 79 },
  "TXXTXXT": { prediction: "Tài", confidence: 69 },
  "TXXTXXX": { prediction: "Xỉu", confidence: 91 },
  "TXXXTTT": { prediction: "Tài", confidence: 69 },
  "TXXXTTX": { prediction: "Xỉu", confidence: 74 },
  "TXXXTXT": { prediction: "Tài", confidence: 69 },
  "TXXXTXX": { prediction: "Xỉu", confidence: 83 },
  "TXXXXTT": { prediction: "Tài", confidence: 65 },
  "TXXXXTX": { prediction: "Xỉu", confidence: 70 },
  "TXXXXXT": { prediction: "Tài", confidence: 60 },
  "TXXXXXX": { prediction: "Xỉu", confidence: 99 },
  "XTTTTTT": { prediction: "Tài", confidence: 79 },
  "XTTTTTX": { prediction: "Xỉu", confidence: 84 },
  "XTTTTXT": { prediction: "Tài", confidence: 75 },
  "XTTTTXX": { prediction: "Xỉu", confidence: 85 },
  "XTTTXTT": { prediction: "Tài", confidence: 69 },
  "XTTTXTX": { prediction: "Xỉu", confidence: 79 },
  "XTTTXXT": { prediction: "Tài", confidence: 69 },
  "XTTTXXX": { prediction: "Xỉu", confidence: 93 },
  "XTTXTTT": { prediction: "Tài", confidence: 74 },
  "XTTXTTX": { prediction: "Xỉu", confidence: 79 },
  "XTTXTXT": { prediction: "Tài", confidence: 69 },
  "XTTXTXX": { prediction: "Xỉu", confidence: 85 },
  "XTTXXTT": { prediction: "Tài", confidence: 69 },
  "XTTXXTX": { prediction: "Xỉu", confidence: 75 },
  "XTTXXXT": { prediction: "Tài", confidence: 65 },
  "XTTXXXX": { prediction: "Xỉu", confidence: 97 },
  "XTXTTTT": { prediction: "Tài", confidence: 74 },
  "XTXTTTX": { prediction: "Xỉu", confidence: 79 },
  "XTXTTXT": { prediction: "Tài", confidence: 69 },
  "XTXTTXX": { prediction: "Xỉu", confidence: 84 },
  "XTXTXTT": { prediction: "Tài", confidence: 69 },
  "XTXTXTX": { prediction: "Xỉu", confidence: 74 },
  "XTXTXXT": { prediction: "Tài", confidence: 64 },
  "XTXTXXX": { prediction: "Xỉu", confidence: 91 },
  "XTXXTTT": { prediction: "Tài", confidence: 69 },
  "XTXXTTX": { prediction: "Xỉu", confidence: 74 },
  "XTXXTXT": { prediction: "Tài", confidence: 69 },
  "XTXXTXX": { prediction: "Xỉu", confidence: 83 },
  "XTXXXTT": { prediction: "Tài", confidence: 65 },
  "XTXXXTX": { prediction: "Xỉu", confidence: 70 },
  "XTXXXXT": { prediction: "Tài", confidence: 60 },
  "XTXXXXX": { prediction: "Xỉu", confidence: 99 },
  "XXTTTTT": { prediction: "Tài", confidence: 74 },
  "XXTTTTX": { prediction: "Xỉu", confidence: 79 },
  "XXTTTXT": { prediction: "Tài", confidence: 69 },
  "XXTTTXX": { prediction: "Xỉu", confidence: 84 },
  "XXTTXTT": { prediction: "Tài", confidence: 69 },
  "XXTTXTX": { prediction: "Xỉu", confidence: 74 },
  "XXTTXXT": { prediction: "Tài", confidence: 64 },
  "XXTTXXX": { prediction: "Xỉu", confidence: 91 },
  "XXTXTXT": { prediction: "Tài", confidence: 69 },
  "XXTXTXX": { prediction: "Xỉu", confidence: 79 },
  "XXTXXTT": { prediction: "Tài", confidence: 69 },
  "XXTXXTX": { prediction: "Xỉu", confidence: 74 },
  "XXTXXXT": { prediction: "Tài", confidence: 64 },
  "XXTXXXX": { prediction: "Xỉu", confidence: 95 },
  "XXXTTTT": { prediction: "Tài", confidence: 69 },
  "XXXTTTX": { prediction: "Xỉu", confidence: 74 },
  "XXXTTXT": { prediction: "Tài", confidence: 69 },
  "XXXTTXX": { prediction: "Xỉu", confidence: 79 },
  "XXXTXTX": { prediction: "Xỉu", confidence: 74 },
  "XXXTXXT": { prediction: "Tài", confidence: 69 },
  "XXXTXXX": { prediction: "Xỉu", confidence: 87 },
  "XXXXTTT": { prediction: "Tài", confidence: 69 },
  "XXXXTTX": { prediction: "Xỉu", confidence: 69 },
  "XXXXTXT": { prediction: "Tài", confidence: 64 },
  "XXXXTXX": { prediction: "Xỉu", confidence: 75 },
  "XXXXXTT": { prediction: "Tài", confidence: 65 },
  "XXXXXTX": { prediction: "Xỉu", confidence: 70 },
  "XXXXXXT": { prediction: "Tài", confidence: 60 },
  "XXXXXXX": { prediction: "Xỉu", confidence: 99 },

  // 8-dice patterns (256 variants) - Ultra VIP system
  "TTTTTTTT": { prediction: "Tài", confidence: 86 },
  "TTTTTTTX": { prediction: "Tài", confidence: 96 },
  "TTTTTTXT": { prediction: "Tài", confidence: 91 },
  "TTTTTTXX": { prediction: "Xỉu", confidence: 89 },
  "TTTTTXXX": { prediction: "Xỉu", confidence: 97 },
  "TTTTXXXX": { prediction: "Xỉu", confidence: 98 },
  "TTTXXXXX": { prediction: "Xỉu", confidence: 99 },
  "TTXXXXXX": { prediction: "Xỉu", confidence: 91 },
  "TXXXXXXX": { prediction: "Xỉu", confidence: 99.7 },
  "XXXXXXXX": { prediction: "Xỉu", confidence: 91 },
  "XXXXXXTT": { prediction: "Tài", confidence: 72 },
  "XXXXXTTT": { prediction: "Tài", confidence: 77 },
  "XXXXTTTT": { prediction: "Tài", confidence: 82 },
  "XXXTTTTT": { prediction: "Tài", confidence: 87 },
  "XXTTTTTT": { prediction: "Tài", confidence: 92 },
  "XTTTTTTT": { prediction: "Tài", confidence: 96 }
};

// Health monitoring
function startHealthMonitor() {
  setInterval(() => {
    const now = Date.now();
    const inactiveDuration = now - lastActivity;
    
    if (inactiveDuration > HEALTH_CHECK_INTERVAL * 2) {
      console.log(`[Health] No activity for ${Math.floor(inactiveDuration/1000)}s - Reconnecting...`);
      connectWebSocket();
    }
    
    // Log memory usage
    const memoryUsage = process.memoryUsage();
    console.log(`[Health] Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB used, ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB total`);
    
    // Prevent memory leaks
    if (history.length > HISTORY_MAX_LENGTH * 1.2) {
      console.log(`[Health] Trimming history from ${history.length} to ${HISTORY_MAX_LENGTH}`);
      history = history.slice(-HISTORY_MAX_LENGTH);
    }
  }, HEALTH_CHECK_INTERVAL);
}

// WebSocket connection with robust error handling
function connectWebSocket() {
  if (isShuttingDown) return;
  
  console.log('[WebSocket] Connecting to server...');
  
  // Close existing connection if any
  if (wsClient) {
    try {
      wsClient.removeAllListeners();
      if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.close();
      }
    } catch (e) {
      console.error('[WebSocket] Error cleaning up previous connection:', e);
    }
  }

  wsClient = new WebSocket(WS_URL, {
    handshakeTimeout: 10000, // 10 seconds timeout
    maxPayload: 1048576, // 1MB max payload
  });
  
  wsClient.on('open', () => {
    console.log('[WebSocket] ✅ Connection established');
    lastActivity = Date.now();
    
    // Send initial ping to keep connection alive
    setInterval(() => {
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.ping();
        } catch (e) {
          console.error('[WebSocket] Ping error:', e);
        }
      }
    }, 45000); // Ping every 45 seconds
  });
  
  wsClient.on('message', (data) => {
    try {
      lastActivity = Date.now();
      const result = JSON.parse(data.toString());
      
      if (result.Phien && result.Ket_qua && result.Xuc_xac_1 !== undefined) {
        console.log(`[WebSocket] Received result - Session ${result.Phien}: ${result.Ket_qua}`);
        
        const historyEntry = {
          phien: result.Phien,
          result: result.Ket_qua,
          sum: result.Tong,
          xucxac: [result.Xuc_xac_1, result.Xuc_xac_2, result.Xuc_xac_3],
        };
        
        // Prevent duplicates and limit history size
        if (!history.some(h => h.phien === result.Phien)) {
          history.push(historyEntry);
          if (history.length > HISTORY_MAX_LENGTH) {
            history = history.slice(-HISTORY_MAX_LENGTH);
          }
        }
        currentSession = historyEntry;
      }
    } catch (error) {
      console.error('[WebSocket] Message processing error:', error);
    }
  });
  
  wsClient.on('close', (code, reason) => {
    console.log(`[WebSocket] ❌ Connection closed (Code: ${code}, Reason: ${reason || 'none'})`);
    if (!isShuttingDown) {
      console.log(`[WebSocket] Reconnecting in ${RECONNECT_DELAY/1000} seconds...`);
      setTimeout(connectWebSocket, RECONNECT_DELAY);
    }
  });
  
  wsClient.on('error', (err) => {
    console.error('[WebSocket] Error:', err);
    // Error event is usually followed by close event, which will trigger reconnect
  });
  
  wsClient.on('ping', () => {
    lastActivity = Date.now();
  });
  
  wsClient.on('pong', () => {
    lastActivity = Date.now();
  });
}

// Prediction functions (unchanged from your original)
function getPredictionOutput() {
  if (!currentSession) {
    return {
      phien_hien_tai: "...",
      du_doan: "...",
      do_tin_cay: "..."
    };
  }

  let prediction = { prediction: "...", confidence: "..." };
  if (history.length >= 3) {
    const lastThree = history.slice(-3).map(h => h.result === "Tài" ? "T" : "X").join("");
    prediction = patternPredictions[lastThree] || {
      prediction: history[history.length-1].result === "Tài" ? "Xỉu" : "Tài",
      confidence: 50
    };
  }

  return {
    phien_hien_tai: currentSession.phien + 1,
    du_doan: prediction.prediction,
    do_tin_cay: prediction.confidence
  };
}

function getCompleteData() {
  if (!currentSession) {
    return {
      phien: "...",
      xuc_xac: [0, 0, 0],
      ket_qua: "...",
      tong: 0,
      pattern: "",
      algorithm: ""
    };
  }

  const patternHistory = history.map(h => h.result === "Tài" ? "T" : "X").join("");
  
  return {
    phien: currentSession.phien,
    xuc_xac: currentSession.xucxac,
    ket_qua: currentSession.result.charAt(0),
    tong: currentSession.sum,
    pattern: patternHistory,
    algorithm: patternHistory.slice(-6)
  };
}

// Initialize server
const app = express();
app.use(cors());

// Middleware to prevent requests during shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.status(503).json({ error: 'Server is shutting down' });
  } else {
    next();
  }
});

// Main endpoint
app.get('/api/789club', (req, res) => {
  try {
    const prediction = getPredictionOutput();
    const data = getCompleteData();
    
    res.json({
      phien_hien_tai: prediction.phien_hien_tai,
      du_doan: prediction.du_doan,
      do_tin_cay: prediction.do_tin_cay,
      data: data,
      status: 'healthy',
      last_activity: new Date(lastActivity).toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('[API] Error handling request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  const now = Date.now();
  const isHealthy = (now - lastActivity) < HEALTH_CHECK_INTERVAL * 2;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    last_activity: new Date(lastActivity).toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    history_length: history.length
  });
});

// Start server
const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  connectWebSocket();
  startHealthMonitor();
});

// Graceful shutdown
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('[Shutdown] Starting graceful shutdown...');
  
  // Close WebSocket
  if (wsClient) {
    try {
      wsClient.close();
    } catch (e) {
      console.error('[Shutdown] Error closing WebSocket:', e);
    }
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('[Shutdown] HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('[Shutdown] Force shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
