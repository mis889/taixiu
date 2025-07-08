const Fastify = require("fastify");
const WebSocket = require("ws");
const crypto = require("crypto");
const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3003;

let hitResults = [];
let hitWS = null;
let hitInterval = null;

function connectHitWebSocket() {
  hitWS = new WebSocket("wss://carkgwaiz.hytsocesk.com/websocket");

  hitWS.on("open", () => {
    const authPayload = [
      1,
      "MiniGame",
      "",
      "",
      {
        agentId: "1",
        accessToken: "1-87eb5bcde00a1f5b3de92664a0ff9f91",
        reconnect: true,
      },
    ];
    hitWS.send(JSON.stringify(authPayload));

    clearInterval(hitInterval);
    hitInterval = setInterval(() => {
      const taiXiuPayload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
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

function xorReduce(arr) {
  return arr.reduce((a, b) => a ^ b, 0);
}

function analyzeMD5Advanced(md5) {
  const hexPairs = [];
  for (let i = 0; i < 32; i += 2) hexPairs.push(parseInt(md5.slice(i, i + 2), 16));
  const md5Int = BigInt("0x" + md5);
  const nChars = md5.length;
  const digitsSum = [...md5].reduce((sum, c) => sum + parseInt(c, 16), 0);
  const hexSum = hexPairs.reduce((a, b) => a + b, 0);
  const binaryOnes = md5Int.toString(2).split("1").length - 1;
  const xorValue = xorReduce(hexPairs);

  const lucas = [2, 1];
  for (let i = 0; i < 13; i++) lucas.push(lucas[lucas.length - 1] + lucas[lucas.length - 2]);
  const lucasWeightedSum = hexPairs.slice(0, 15).reduce((sum, val, i) => sum + val * lucas[i], 0);

  const fourierEnergy = hexPairs.slice(1).reduce((sum, val, i) => sum + Math.abs(val - hexPairs[i]), 0);

  const sha224 = crypto.createHash("sha224").update(md5).digest("hex");
  const sha224Sum = [...Array(sha224.length / 2)].reduce((sum, _, i) => sum + parseInt(sha224.slice(i * 2, i * 2 + 2), 16), 0);
  const sha224Head = parseInt(sha224.slice(0, 2), 16);

  const sha1 = crypto.createHash("sha1").update(md5).digest("hex");
  const sha1Symmetry = Array(16).reduce((sum, _, i) => sum + (sha1[i] === sha1[39 - i] ? 1 : 0), 0);

  const blake2b = crypto.createHash("blake2b512").update(md5).digest("hex");
  const blake2bBytes = [...Array(blake2b.length / 2)].map((_, i) => parseInt(blake2b.slice(i * 2, i * 2 + 2), 16));
  const blake2bXor = xorReduce(blake2bBytes);

  const symmetryScore = Array(16).reduce((sum, _, i) => sum + (md5[i] === md5[i + 16] ? 1 : 0), 0);
  const geometricMean = Math.pow(hexPairs.reduce((p, n) => p * (n + 1), 1), 1 / hexPairs.length);
  const combinedXor = xorValue ^ sha224Head;

  let a = 0, b = 1;
  for (let i = 0; i < digitsSum; i++) [a, b] = [b, (a + b) % 100];
  const fibonacciScore = b;

  const weightedEdge = (hexPairs[0] * 3 + hexPairs[hexPairs.length - 1] * 2) % 100;
  const modPrimes = [43, 47, 53, 59, 61, 67];
  const primeModsSum = modPrimes.reduce((sum, p) => sum + (hexSum % p), 0);
  const maxRepeat = Math.max(...[...new Set(md5)].map((c) => md5.split(c).length - 1));
  const oddChars = [...md5].filter((c) => parseInt(c, 16) % 2).length;
  const mid = hexPairs.slice(hexPairs.length / 4, 3 * hexPairs.length / 4);
  const middleBytes = mid.reduce((a, b) => a + b, 0);
  const fiboChars = [...md5].filter((c) => "12358".includes(c)).length;

  const entropy = [...new Set(md5)].reduce((sum, c) => {
    const freq = md5.split(c).length - 1;
    const p = freq / nChars;
    return sum - p * Math.log2(p);
  }, 0);

  const totalXor = xorValue ^ blake2bXor ^ combinedXor;

  const features = [
    digitsSum, hexSum, binaryOnes, xorValue, lucasWeightedSum,
    geometricMean, new Set(md5).size, fourierEnergy, sha224Sum,
    symmetryScore, combinedXor, fibonacciScore, blake2bXor,
    weightedEdge, primeModsSum, maxRepeat, oddChars, middleBytes,
    fiboChars, sha1Symmetry, entropy, totalXor
  ];

  const totalScore = features.reduce((s, f) => s + f * 0.05, 0) % 100;
  return {
    tai: Math.round(totalScore * 100) / 100,
    xiu: Math.round((100 - totalScore) * 100) / 100,
  };
}

fastify.get("/api/hit", async (request, reply) => {
  const validResults = [...hitResults].reverse().filter((item) => item.d1 && item.d2 && item.d3);

  if (validResults.length < 1) {
    return {
      current_result: null,
      current_session: null,
      next_session: null,
      prediction: null,
      used_pattern: "",
      confidence: "0%",
      md5: null
    };
  }

  const current = validResults[0];
  const total = current.d1 + current.d2 + current.d3;
  const result = total >= 11 ? "Tài" : "Xỉu";
  const currentSession = current.sid;
  const nextSession = currentSession + 1;

  const dummyMD5 = crypto.createHash("md5").update(`${current.d1}${current.d2}${current.d3}`).digest("hex");
  const { tai, xiu } = analyzeMD5Advanced(dummyMD5);

  const pattern = validResults
    .slice(0, 6)
    .map((item) => {
      const sum = item.d1 + item.d2 + item.d3;
      return sum >= 11 ? "T" : "X";
    })
    .reverse()
    .join("");

  return {
    current_result: result,
    current_session: currentSession,
    next_session: nextSession,
    prediction: tai > xiu ? "Tài" : "Xỉu",
    used_pattern: pattern,
    confidence: `${Math.max(tai, xiu).toFixed(2)}%`,
    md5: dummyMD5
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
