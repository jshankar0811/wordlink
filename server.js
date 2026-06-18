const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const compounds = require("./data/compounds.json");
const joinedWords = require("./data/joined-words.json").map(normalizeWord);

const pairSet = new Set();
const joinedPairSet = new Set();
const nextWords = new Map();
const knownSegments = new Set();

for (const [first, second] of compounds) {
  const a = normalizeWord(first);
  const b = normalizeWord(second);
  knownSegments.add(a);
  knownSegments.add(b);
  pairSet.add(pairKey(a, b));
  if (!nextWords.has(a)) nextWords.set(a, new Set());
  nextWords.get(a).add(b);
}

for (const word of joinedWords) {
  for (let i = 2; i <= word.length - 2; i += 1) {
    const first = word.slice(0, i);
    const second = word.slice(i);
    if (!knownSegments.has(first)) continue;
    joinedPairSet.add(pairKey(first, second));
    if (!nextWords.has(first)) nextWords.set(first, new Set());
    nextWords.get(first).add(second);
  }
}

const rooms = new Map();
const clients = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: "Something went sideways on the server." });
    });
    return;
  }

  serveStatic(url.pathname, res);
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === "playing" && room.deadline && now >= room.deadline) {
      const active = room.players[room.turnIndex];
      const other = room.players[1 - room.turnIndex];
      room.status = "finished";
      room.winnerId = other?.id || null;
      room.message = `${active?.name || "A player"} ran out of time.`;
      room.deadline = null;
      broadcast(room.code);
    }
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`Wordlink is running at http://localhost:${PORT}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/events") {
    handleEvents(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/room") {
    const room = rooms.get(url.searchParams.get("code")?.toUpperCase());
    const playerId = url.searchParams.get("playerId");
    if (!room) return sendJson(res, 404, { error: "Room not found." });
    return sendJson(res, 200, viewRoom(room, playerId));
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readBody(req);
    const room = createRoom(body);
    return sendJson(res, 201, viewRoom(room, room.players[0].id));
  }

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await readBody(req);
    const room = rooms.get(String(body.code || "").trim().toUpperCase());
    if (!room) return sendJson(res, 404, { error: "Room not found." });
    const result = joinRoom(room, body);
    return sendJson(res, result.status, result.payload);
  }

  if (req.method === "POST" && url.pathname === "/api/play") {
    const body = await readBody(req);
    const result = playTurn(body);
    return sendJson(res, result.status, result.payload);
  }

  if (req.method === "POST" && url.pathname === "/api/challenge") {
    const body = await readBody(req);
    const result = challengeTurn(body);
    return sendJson(res, result.status, result.payload);
  }

  if (req.method === "POST" && url.pathname === "/api/accept") {
    const body = await readBody(req);
    const result = acceptPendingTurn(body);
    return sendJson(res, result.status, result.payload);
  }

  if (req.method === "POST" && url.pathname === "/api/rematch") {
    const body = await readBody(req);
    const result = rematch(body);
    return sendJson(res, result.status, result.payload);
  }

  sendJson(res, 404, { error: "Not found." });
}

function createRoom(body) {
  const code = makeRoomCode();
  const host = makePlayer(body.name || "Player A");
  const settings = {
    timerSeconds: clamp(Number(body.timerSeconds) || 45, 10, 120),
    challenges: body.challenges !== false
  };
  const start = randomStartingPair();
  const room = {
    code,
    settings,
    players: [host],
    status: "waiting",
    turnIndex: 0,
    startPair: start,
    currentPrompt: start[1],
    pendingReview: null,
    usedPairs: new Set([pairKey(start[0], start[1])]),
    chain: [
      {
        first: start[0],
        second: start[1],
        playerId: "system",
        playerName: "Wordlink",
        challenged: false,
        valid: true,
        at: Date.now()
      }
    ],
    deadline: null,
    winnerId: null,
    message: "Share the room code with Player B.",
    createdAt: Date.now()
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(room, body) {
  const existing = room.players.find((player) => player.id === body.playerId);
  if (existing) return { status: 200, payload: viewRoom(room, existing.id) };
  if (room.players.length >= 2) {
    return { status: 409, payload: { error: "This room already has two players." } };
  }

  const player = makePlayer(body.name || "Player B");
  room.players.push(player);
  room.status = "playing";
  room.turnIndex = Math.floor(Math.random() * 2);
  room.deadline = Date.now() + room.settings.timerSeconds * 1000;
  room.message = `${room.players[room.turnIndex].name} starts from "${room.currentPrompt}".`;
  broadcast(room.code);
  return { status: 200, payload: viewRoom(room, player.id) };
}

function playTurn(body) {
  const room = rooms.get(String(body.code || "").trim().toUpperCase());
  if (!room) return fail(404, "Room not found.");
  if (room.status !== "playing") return fail(409, "This room is not currently playing.");
  if (room.pendingReview) return fail(409, "A link is already waiting for review.");

  const playerIndex = room.players.findIndex((player) => player.id === body.playerId);
  if (playerIndex < 0) return fail(403, "You are not in this room.");
  if (playerIndex !== room.turnIndex) return fail(409, "It is not your turn.");

  const second = normalizeWord(body.word);
  if (!second) return fail(400, "Enter one word to link.");
  if (!/^[a-z]+$/.test(second)) return fail(400, "Use letters only for the linked word.");

  const first = room.currentPrompt;
  const key = pairKey(first, second);
  const validation = validateLink(first, second);
  if (room.usedPairs.has(key)) return fail(409, `"${formatPair(first, second)}" was already used.`);
  const player = room.players[playerIndex];
  if (!validation.valid) {
    room.pendingReview = {
      first,
      second,
      playerId: player.id,
      playerName: player.name,
      at: Date.now()
    };
    room.status = "reviewing";
    room.turnIndex = 1 - room.turnIndex;
    room.deadline = null;
    room.message = `${room.players[room.turnIndex].name} can accept or challenge "${formatPair(first, second)}".`;
    broadcast(room.code);
    return { status: 202, payload: viewRoom(room, body.playerId) };
  }

  const entry = {
    first,
    second,
    playerId: player.id,
    playerName: player.name,
    challenged: false,
    valid: true,
    validationType: validation.type,
    at: Date.now()
  };
  room.chain.push(entry);
  room.usedPairs.add(key);
  room.currentPrompt = second;
  room.turnIndex = 1 - room.turnIndex;
  room.deadline = Date.now() + room.settings.timerSeconds * 1000;
  room.message = `${player.name} played "${formatLink(first, second, validation.type)}".`;
  broadcast(room.code);
  return { status: 200, payload: viewRoom(room, body.playerId) };
}

function acceptPendingTurn(body) {
  const room = rooms.get(String(body.code || "").trim().toUpperCase());
  if (!room) return fail(404, "Room not found.");
  if (room.status !== "reviewing" || !room.pendingReview) return fail(409, "There is no link waiting for review.");

  const reviewerIndex = room.players.findIndex((player) => player.id === body.playerId);
  if (reviewerIndex < 0) return fail(403, "You are not in this room.");
  if (reviewerIndex !== room.turnIndex) return fail(409, "Only the opponent can accept this link.");

  const pending = room.pendingReview;
  const key = pairKey(pending.first, pending.second);
  if (room.usedPairs.has(key)) return fail(409, `"${formatPair(pending.first, pending.second)}" was already used.`);

  const entry = {
    first: pending.first,
    second: pending.second,
    playerId: pending.playerId,
    playerName: pending.playerName,
    challenged: false,
    valid: true,
    validationType: "accepted",
    at: Date.now()
  };

  room.chain.push(entry);
  room.usedPairs.add(key);
  room.currentPrompt = pending.second;
  room.status = "playing";
  room.pendingReview = null;
  room.deadline = Date.now() + room.settings.timerSeconds * 1000;
  room.message = `${room.players[reviewerIndex].name} accepted "${formatPair(entry.first, entry.second)}".`;
  broadcast(room.code);
  return { status: 200, payload: viewRoom(room, body.playerId) };
}

function challengeTurn(body) {
  const room = rooms.get(String(body.code || "").trim().toUpperCase());
  if (!room) return fail(404, "Room not found.");
  if (room.status !== "playing" && room.status !== "reviewing") return fail(409, "This room is not currently playing.");
  if (!room.settings.challenges) return fail(409, "Challenges are turned off.");

  const challengerIndex = room.players.findIndex((player) => player.id === body.playerId);
  if (challengerIndex < 0) return fail(403, "You are not in this room.");
  const challenger = room.players[challengerIndex];

  if (room.status === "reviewing" && room.pendingReview) {
    if (challengerIndex !== room.turnIndex) return fail(409, "Only the opponent can challenge this link.");
    const pending = room.pendingReview;
    const challengedPlayer = room.players.find((player) => player.id === pending.playerId);
    room.status = "finished";
    room.pendingReview = null;
    room.deadline = null;
    room.winnerId = challenger.id;
    room.message = `${challenger.name} challenged "${formatPair(pending.first, pending.second)}". ${challengedPlayer?.name || "The other player"} loses the round.`;
    broadcast(room.code);
    return { status: 200, payload: viewRoom(room, body.playerId) };
  }

  const last = room.chain[room.chain.length - 1];
  if (!last || last.playerId === "system") return fail(409, "There is no player move to challenge.");
  if (last.playerId === body.playerId) return fail(409, "You cannot challenge your own move.");
  if (last.challenged) return fail(409, "That move has already been challenged.");
  if (last.validationType === "accepted") return fail(409, "That link was already accepted by the opponent.");

  last.challenged = true;
  const lastStillValid = validateLink(last.first, last.second).valid;
  const challengedPlayer = room.players.find((player) => player.id === last.playerId);

  room.status = "finished";
  room.deadline = null;
  room.winnerId = lastStillValid ? challengedPlayer.id : challenger.id;
  room.message = lastStillValid
    ? `${challenger.name}'s challenge failed. "${formatLink(last.first, last.second, last.validationType)}" is valid.`
    : `${challenger.name}'s challenge succeeded. "${formatPair(last.first, last.second)}" is invalid.`;
  broadcast(room.code);
  return { status: 200, payload: viewRoom(room, body.playerId) };
}

function rematch(body) {
  const room = rooms.get(String(body.code || "").trim().toUpperCase());
  if (!room) return fail(404, "Room not found.");
  if (!room.players.some((player) => player.id === body.playerId)) {
    return fail(403, "You are not in this room.");
  }

  const start = randomStartingPair();
  room.status = room.players.length === 2 ? "playing" : "waiting";
  room.turnIndex = room.players.length === 2 ? Math.floor(Math.random() * 2) : 0;
  room.startPair = start;
  room.currentPrompt = start[1];
  room.pendingReview = null;
  room.usedPairs = new Set([pairKey(start[0], start[1])]);
  room.chain = [{
    first: start[0],
    second: start[1],
    playerId: "system",
    playerName: "Wordlink",
    challenged: false,
    valid: true,
    at: Date.now()
  }];
  room.deadline = room.status === "playing" ? Date.now() + room.settings.timerSeconds * 1000 : null;
  room.winnerId = null;
  room.message = room.status === "playing"
    ? `${room.players[room.turnIndex].name} starts from "${room.currentPrompt}".`
    : "Waiting for Player B.";
  broadcast(room.code);
  return { status: 200, payload: viewRoom(room, body.playerId) };
}

function handleEvents(req, res, url) {
  const code = url.searchParams.get("code")?.toUpperCase();
  const playerId = url.searchParams.get("playerId");
  const room = rooms.get(code);
  if (!room) {
    sendJson(res, 404, { error: "Room not found." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`data: ${JSON.stringify(viewRoom(room, playerId))}\n\n`);

  const clientId = crypto.randomUUID();
  if (!clients.has(code)) clients.set(code, new Map());
  clients.get(code).set(clientId, { res, playerId });

  req.on("close", () => {
    clients.get(code)?.delete(clientId);
  });
}

function broadcast(code) {
  const room = rooms.get(code);
  const roomClients = clients.get(code);
  if (!room || !roomClients) return;
  for (const client of roomClients.values()) {
    client.res.write(`data: ${JSON.stringify(viewRoom(room, client.playerId))}\n\n`);
  }
}

function viewRoom(room, viewerId) {
  const active = room.players[room.turnIndex] || null;
  return {
    code: room.code,
    settings: room.settings,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isYou: player.id === viewerId
    })),
    activePlayerId: active?.id || null,
    activePlayerName: active?.name || null,
    currentPrompt: room.currentPrompt,
    pendingReview: room.pendingReview ? {
      first: room.pendingReview.first,
      second: room.pendingReview.second,
      phrase: formatPair(room.pendingReview.first, room.pendingReview.second),
      playerId: room.pendingReview.playerId,
      playerName: room.pendingReview.playerName,
      at: room.pendingReview.at
    } : null,
    chain: room.chain.map((entry) => ({
      first: entry.first,
      second: entry.second,
      phrase: formatPair(entry.first, entry.second),
      display: formatLink(entry.first, entry.second, entry.validationType),
      validationType: entry.validationType || "pair",
      playerName: entry.playerName,
      playerId: entry.playerId,
      challenged: entry.challenged,
      at: entry.at
    })),
    secondsLeft: room.deadline ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)) : null,
    winnerId: room.winnerId,
    winnerName: room.players.find((player) => player.id === room.winnerId)?.name || null,
    message: room.message,
    suggestions: room.status === "playing" ? getSuggestions(room.currentPrompt, 4) : []
  };
}

function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function randomStartingPair() {
  for (let i = 0; i < 50; i += 1) {
    const pair = compounds[Math.floor(Math.random() * compounds.length)].map(normalizeWord);
    if ((nextWords.get(pair[1])?.size || 0) >= 2) return pair;
  }
  return ["side", "line"];
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function makePlayer(name) {
  return {
    id: crypto.randomUUID(),
    name: String(name).trim().slice(0, 24) || "Player"
  };
}

function getSuggestions(first, limit = 6) {
  return Array.from(nextWords.get(first) || [])
    .slice(0, limit)
    .map((second) => formatLink(first, second, validateLink(first, second).type));
}

function validateLink(first, second) {
  const a = normalizeWord(first);
  const b = normalizeWord(second);
  if (pairSet.has(pairKey(a, b))) return { valid: true, type: "pair" };
  if (joinedPairSet.has(pairKey(a, b))) return { valid: true, type: "joined" };
  return { valid: false, type: "missing" };
}

function normalizeWord(word) {
  return String(word || "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

function pairKey(first, second) {
  return `${first}:${second}`;
}

function formatPair(first, second) {
  return `${first} ${second}`;
}

function formatLink(first, second, type) {
  return type === "joined" ? `${first}${second}` : formatPair(first, second);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fail(status, message, extra = {}) {
  return { status, payload: { error: message, ...extra } };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
