const state = {
  room: null,
  playerId: localStorage.getItem("wordlink.playerId") || null,
  eventSource: null,
  tickTimer: null
};

const lobbyView = document.querySelector("#lobbyView");
const gameView = document.querySelector("#gameView");
const createForm = document.querySelector("#createForm");
const joinForm = document.querySelector("#joinForm");
const playForm = document.querySelector("#playForm");
const challengeButton = document.querySelector("#challengeButton");
const acceptButton = document.querySelector("#acceptButton");
const rematchButton = document.querySelector("#rematchButton");
const leaveButton = document.querySelector("#leaveButton");
const copyCodeButton = document.querySelector("#copyCodeButton");
const errorText = document.querySelector("#errorText");
const reviewPanel = document.querySelector("#reviewPanel");
const reviewPhrase = document.querySelector("#reviewPhrase");
const reviewCopy = document.querySelector("#reviewCopy");

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const form = new FormData(createForm);
  const payload = {
    name: form.get("name"),
    timerSeconds: Number(form.get("timerSeconds")),
    challenges: form.get("challenges") === "on"
  };
  const room = await api("/api/rooms", payload);
  enterRoom(room);
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const form = new FormData(joinForm);
  const room = await api("/api/join", {
    name: form.get("name"),
    code: form.get("code")
  });
  enterRoom(room);
});

playForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const word = new FormData(playForm).get("word");
  try {
    const room = await api("/api/play", {
      code: state.room.code,
      playerId: state.playerId,
      word
    });
    playForm.reset();
    render(room);
  } catch (error) {
    showError(error.message);
    if (error.payload?.suggestions?.length) {
      renderSuggestions(error.payload.suggestions);
    }
  }
});

challengeButton.addEventListener("click", async () => {
  clearError();
  try {
    const room = await api("/api/challenge", {
      code: state.room.code,
      playerId: state.playerId
    });
    render(room);
  } catch (error) {
    showError(error.message);
  }
});

acceptButton.addEventListener("click", async () => {
  clearError();
  try {
    const room = await api("/api/accept", {
      code: state.room.code,
      playerId: state.playerId
    });
    render(room);
  } catch (error) {
    showError(error.message);
  }
});

rematchButton.addEventListener("click", async () => {
  clearError();
  const room = await api("/api/rematch", {
    code: state.room.code,
    playerId: state.playerId
  });
  render(room);
});

leaveButton.addEventListener("click", () => {
  if (state.eventSource) state.eventSource.close();
  state.room = null;
  gameView.classList.add("hidden");
  lobbyView.classList.remove("hidden");
});

copyCodeButton.addEventListener("click", async () => {
  if (!state.room) return;
  await navigator.clipboard.writeText(state.room.code);
  copyCodeButton.textContent = "Done";
  setTimeout(() => {
    copyCodeButton.textContent = "Copy";
  }, 900);
});

function enterRoom(room) {
  const you = room.players.find((player) => player.isYou);
  if (you) {
    state.playerId = you.id;
    localStorage.setItem("wordlink.playerId", you.id);
  }
  lobbyView.classList.add("hidden");
  gameView.classList.remove("hidden");
  subscribe(room.code);
  render(room);
}

function subscribe(code) {
  if (state.eventSource) state.eventSource.close();
  const params = new URLSearchParams({ code, playerId: state.playerId });
  state.eventSource = new EventSource(`/api/events?${params}`);
  state.eventSource.onmessage = (event) => {
    render(JSON.parse(event.data));
  };
  state.eventSource.onerror = () => {
    showError("Live connection paused. Refresh if the game stops updating.");
  };
}

function render(room) {
  state.room = room;
  document.querySelector("#roomLine").textContent = `Room ${room.code}`;
  document.querySelector("#promptWord").textContent = room.currentPrompt;
  document.querySelector("#fixedWord").textContent = room.currentPrompt;
  document.querySelector("#turnName").textContent = room.activePlayerName || "-";
  document.querySelector("#gameMessage").textContent = room.winnerName
    ? `${room.winnerName} wins. ${room.message}`
    : room.message;

  renderPlayers(room);
  renderChain(room);
  renderSuggestions(room.suggestions || []);
  renderReview(room);
  updateControls(room);
  updateTimer(room.secondsLeft);
}

function renderPlayers(room) {
  const players = document.querySelector("#players");
  players.innerHTML = "";
  for (const player of room.players) {
    const item = document.createElement("div");
    item.className = `player${player.id === room.activePlayerId ? " active" : ""}`;
    item.innerHTML = `<span>${escapeHtml(player.name)}${player.isYou ? " (you)" : ""}</span><small>${player.id === room.activePlayerId ? "turn" : ""}</small>`;
    players.append(item);
  }
  if (room.players.length < 2) {
    const waiting = document.createElement("div");
    waiting.className = "player";
    waiting.innerHTML = "<span>Waiting for Player B</span><small>open</small>";
    players.append(waiting);
  }
}

function renderChain(room) {
  const chain = document.querySelector("#chain");
  chain.innerHTML = "";
  [...room.chain].reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="chain-row">
        <span class="chain-word">${escapeHtml(entry.first)}</span>
        <span class="chain-arrow">to</span>
        <span class="chain-word">${escapeHtml(entry.second)}</span>
      </div>
      <span class="chain-meta">${escapeHtml(entry.playerName)}</span>
    `;
    chain.append(item);
  });
}

function renderSuggestions(suggestions) {
  const container = document.querySelector("#suggestions");
  container.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const chip = document.createElement("span");
    chip.textContent = suggestion;
    container.append(chip);
  });
}

function renderReview(room) {
  if (!room.pendingReview) {
    reviewPanel.classList.add("hidden");
    reviewPhrase.textContent = "";
    reviewCopy.textContent = "";
    return;
  }

  const you = room.players.find((player) => player.isYou);
  const isReviewer = Boolean(you && room.activePlayerId === you.id);
  reviewPanel.classList.remove("hidden");
  reviewPhrase.textContent = room.pendingReview.phrase;
  reviewCopy.textContent = isReviewer
    ? `${room.pendingReview.playerName} played this unknown link. Accept it or challenge the round.`
    : `Waiting for ${room.activePlayerName} to accept or challenge your link.`;
}

function updateControls(room) {
  const you = room.players.find((player) => player.isYou);
  const isYourTurn = Boolean(you && room.activePlayerId === you.id && room.status === "playing");
  const last = room.chain[room.chain.length - 1];
  const isReviewer = Boolean(you && room.activePlayerId === you.id && room.status === "reviewing");
  const canChallenge = Boolean(
    room.settings.challenges &&
    (
      isReviewer ||
      (
        room.status === "playing" &&
        last &&
        last.playerId !== "system" &&
        last.playerId !== state.playerId &&
        last.validationType !== "accepted" &&
        !last.challenged
      )
    )
  );

  playForm.querySelector("input").disabled = !isYourTurn;
  playForm.querySelector("button").disabled = !isYourTurn;
  acceptButton.disabled = !isReviewer;
  challengeButton.disabled = !canChallenge;
  rematchButton.disabled = room.players.length < 1;
}

function updateTimer(seconds) {
  const timer = document.querySelector("#timer");
  timer.textContent = seconds == null ? "--" : `${seconds}s`;
  if (state.tickTimer) clearTimeout(state.tickTimer);
  if (seconds > 0) {
    state.tickTimer = setTimeout(() => {
      updateTimer(seconds - 1);
    }, 1000);
  }
}

async function api(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.payload = data;
    throw error;
  }
  return data;
}

function showError(message) {
  errorText.textContent = message;
}

function clearError() {
  errorText.textContent = "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
