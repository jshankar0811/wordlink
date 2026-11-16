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
const modeButtons = document.querySelectorAll(".mode-option");
const newWordButton = document.querySelector("#newWordButton");
const newWordForm = document.querySelector("#newWordForm");
let newWordSubmitting = false;
const minigameButton = document.querySelector("#minigameButton");
const minigamePanel = document.querySelector("#minigamePanel");
const minigameForm = document.querySelector("#minigameForm");
let minigameOpen = false;
let minigameSubmitting = false;

document.querySelectorAll("[data-avatar-picker]").forEach(picker => {
  for (const avatar of WORDLINK_AVATARS) {
    const label = document.createElement("label");
    label.className = "avatar-option";
    label.title = avatar.name;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "avatar";
    input.value = avatar.id;
    input.checked = avatar.id === (localStorage.getItem("wordlink.avatar") || "fox");
    input.setAttribute("aria-label", avatar.name);
    input.addEventListener("change", () => localStorage.setItem("wordlink.avatar", avatar.id));
    const face = document.createElement("span");
    face.textContent = avatar.emoji;
    face.setAttribute("aria-hidden", "true");
    label.append(input, face);
    picker.append(label);
  }
});

minigameButton.addEventListener("click", () => {
  minigameOpen = !minigameOpen;
  closeNewWordForm();
  renderMinigame(state.room);
});

document.querySelector("#closeMinigameButton").addEventListener("click", () => {
  minigameOpen = false;
  renderMinigame(state.room);
  minigameButton.focus();
});

async function minigameAction(route, payload = {}) {
  if (minigameSubmitting) return;
  minigameSubmitting = true;
  document.querySelector("#minigameError").textContent = "";
  updateControls(state.room);
  try {
    const room = await api(route, {code: state.room.code, playerId: state.playerId, ...payload});
    minigameForm.reset();
    render(room);
    if (room.status === "minigame") minigameForm.elements.word.focus();
  } catch (error) {
    document.querySelector("#minigameError").textContent = error.message;
  } finally {
    minigameSubmitting = false;
    if (state.room) updateControls(state.room);
  }
}

document.querySelector("#startMinigameButton").addEventListener("click", () => {
  minigameAction("/api/minigame/start");
});

minigameForm.addEventListener("submit", event => {
  event.preventDefault();
  minigameAction("/api/minigame/guess", {
    minigameId: state.room.minigame.id,
    word: new FormData(minigameForm).get("word")
  });
});

function closeNewWordForm() {
  newWordForm.classList.add("hidden");
  newWordButton.setAttribute("aria-expanded", "false");
  newWordForm.reset();
}

newWordButton.addEventListener("click", () => {
  if (newWordButton.getAttribute("aria-expanded") === "true") {
    closeNewWordForm();
    return;
  }
  clearError();
  minigameOpen = false;
  renderMinigame(state.room);
  newWordForm.classList.remove("hidden");
  newWordButton.setAttribute("aria-expanded", "true");
  newWordForm.elements.word.focus();
});

document.querySelector("#cancelNewWordButton").addEventListener("click", () => {
  closeNewWordForm();
  newWordButton.focus();
});

newWordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (newWordSubmitting) return;
  clearError();
  const word = new FormData(newWordForm).get("word");
  newWordSubmitting = true;
  updateControls(state.room);
  try {
    const room = await api("/api/new-word", {
      code: state.room.code,
      playerId: state.playerId,
      word
    });
    playForm.reset();
    state.promptMode = "end";
    updateModeButtons();
    closeNewWordForm();
    render(room);
  } catch (error) {
    showError(error.message);
  } finally {
    newWordSubmitting = false;
    if (state.room) updateControls(state.room);
  }
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.promptMode = button.dataset.mode;
    updateModeButtons();
    renderPrompt(state.room);
  });
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const form = new FormData(createForm);
  const payload = {
    name: form.get("name"),
    avatar: form.get("avatar"),
    timerSeconds: Number(form.get("timerSeconds")),
    targetScore: Number(form.get("targetScore")),
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
    avatar: form.get("avatar"),
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
      promptMode: state.promptMode || "end",
      word
    });
    playForm.reset();
    render(room);
  } catch (error) {
    showError(error.message);
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
  minigameOpen = false;
  closeNewWordForm();
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
  const previousRoom = state.room;
  state.room = room;
  document.querySelector("#roomLine").textContent = `Room ${room.code}`;
  document.querySelector("#targetScore").textContent = room.settings.targetScore;
  renderPrompt(room);
  const activeAvatar = WORDLINK_AVATARS.find(avatar => avatar.id === room.players.find(player => player.id === room.activePlayerId)?.avatar);
  document.querySelector("#turnName").textContent = `${activeAvatar?.emoji || ""} ${room.activePlayerName || "-"}`.trim();
  document.querySelector("#gameMessage").textContent = room.winnerName
    ? `${room.winnerName} wins. ${room.message}`
    : room.message;

  renderPlayers(room);
  renderChain(room);
  renderReview(room);
  if (previousRoom?.activePlayerId !== room.activePlayerId || previousRoom?.code !== room.code || room.status === "finished") minigameOpen = false;
  renderMinigame(room);
  updateControls(room);
  const wonNewWord = room.minigame?.status === "won" && room.status === "playing" && room.activePlayerId === state.playerId;
  if (wonNewWord && previousRoom?.minigame?.status !== "won") {
    newWordForm.classList.remove("hidden");
    newWordButton.setAttribute("aria-expanded", "true");
    newWordForm.elements.word.focus();
  }
  document.querySelector("#timerLabel").textContent = room.status === "minigame" ? "Minigame" : "Timer";
  updateTimer(room.status === "minigame" ? room.minigame.secondsLeft : room.secondsLeft);
}

function renderPrompt(room) {
  if (!room) return;
  const mode = state.promptMode || "end";
  const option = room.promptOptions?.[mode] || room.promptOptions?.end;
  const word = option?.word || room.currentPrompt;
  document.querySelector("#promptWord").textContent = word;
  document.querySelector("#fixedWord").textContent = word;
}

function renderPlayers(room) {
  const players = document.querySelector("#players");
  players.innerHTML = "";
  for (const player of room.players) {
    const item = document.createElement("div");
    item.className = `player${player.id === room.activePlayerId ? " active" : ""}`;
    const avatar = WORDLINK_AVATARS.find(option => option.id === player.avatar) || WORDLINK_AVATARS[0];
    item.innerHTML = `
      <span class="player-identity"><span class="player-avatar" role="img" aria-label="${avatar.name}">${avatar.emoji}</span><span>${escapeHtml(player.name)}${player.isYou ? " (you)" : ""}</span></span>
      <strong class="player-score">${player.score || 0}</strong>
      <small>${player.id === room.activePlayerId ? "turn" : "points"}</small>
    `;
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
      <div class="chain-row${entry.validationType === "reset" ? " chain-row-reset" : ""}">
        ${entry.validationType === "reset" ? "" : `
          <span class="chain-word">${escapeHtml(entry.first)}</span>
          <span class="chain-arrow">to</span>
        `}
        <span class="chain-word">${escapeHtml(entry.second)}</span>
      </div>
      <span class="chain-meta">${escapeHtml(entry.playerName)}${entry.validationType === "reset" ? " · New starting word" : ""}${entry.points ? ` · ${entry.points} pt${entry.points === 1 ? "" : "s"}` : ""}</span>
    `;
    chain.append(item);
  });
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === (state.promptMode || "end"));
  });
}

function renderMinigame(room) {
  const game = room.minigame;
  const showGame = Boolean(game && ["playing", "minigame"].includes(room.status));
  const visible = showGame || minigameOpen;
  minigamePanel.classList.toggle("hidden", !visible);
  minigameButton.setAttribute("aria-expanded", String(visible));
  document.querySelector("#minigameIntro").classList.toggle("hidden", showGame);
  const active = showGame && game.status === "active";
  const isYou = room.activePlayerId === state.playerId;
  minigameForm.classList.toggle("hidden", !active || !isYou);
  document.querySelector("#minigameLegend").classList.toggle("hidden", !showGame || game.type !== "wordle");
  const board = document.querySelector("#minigameBoard");
  board.replaceChildren();
  document.querySelector("#minigameTitle").textContent = showGame
    ? ({wordle: "Mini Wordle", anagram: "Anagram", missing: "Missing Letters"}[game.type]) : "Win a new word";
  const copy = document.querySelector("#minigameCopy");
  if (!showGame) {
    copy.textContent = "Win Mini Wordle, Anagram, or Missing Letters to choose a new starting word for free. Your turn timer pauses for up to 60 seconds. One attempt per turn. If you lose, your original timer resumes.";
    return;
  }
  if (game.status === "won") {
    copy.textContent = isYou ? "You won! Choose a new starting word for free below. Your turn timer has resumed." : `${room.activePlayerName} won a free new word.`;
  } else if (game.status === "lost") {
    copy.textContent = `The word was ${game.answer.toUpperCase()}. The original turn timer has resumed.`;
  } else {
    copy.textContent = `${isYou ? "" : `${room.activePlayerName} is playing. `}${game.clue} ${game.maxGuesses - game.guesses.length} guesses left.`;
  }
  if (game.type !== "wordle") {
    const letters = document.createElement("div");
    letters.className = "anagram-letters";
    letters.textContent = game.type === "missing" ? game.masked : game.scrambled;
    letters.setAttribute("aria-label", game.type === "missing"
      ? game.masked.split("").map(letter => letter === "_" ? "blank" : letter).join(" ")
      : game.scrambled.split("").join(" "));
    board.append(letters);
  }
  for (let index = 0; index < game.maxGuesses; index += 1) {
    const guess = game.guesses[index];
    const row = document.createElement("div");
    row.className = "guess-row";
    if (game.type === "wordle") {
      for (let letter = 0; letter < 4; letter += 1) {
        const tile = document.createElement("span");
        const mark = guess?.marks[letter];
        tile.className = `guess-tile${mark ? ` ${mark}` : ""}`;
        tile.textContent = guess?.word[letter] || "";
        tile.setAttribute("aria-label", guess ? `${guess.word[letter]}, ${mark === "correct" ? "right spot" : mark === "present" ? "different spot" : "absent"}` : "Empty");
        row.append(tile);
      }
    } else if (guess) {
      row.classList.add("anagram-guess");
      row.textContent = `${guess.word.toUpperCase()} ${game.status === "won" && index === game.guesses.length - 1 ? "✓" : "×"}`;
    }
    board.append(row);
  }
  minigameForm.elements.word.maxLength = game.type === "wordle" ? 4 : (game.masked || game.scrambled).length;
  minigameForm.elements.word.minLength = minigameForm.elements.word.maxLength;
  document.querySelector("#minigameInputLabel").textContent = {
    wordle: "Your four-letter guess", anagram: "Unscramble the word", missing: "Enter the complete word"
  }[game.type];
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
    ? `${room.pendingReview.playerName} played this unknown link for ${room.pendingReview.points} point${room.pendingReview.points === 1 ? "" : "s"}. Accept it or challenge the round.`
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
        last.validationType !== "reset" &&
        !last.challenged
      )
    )
  );

  playForm.querySelector("input").disabled = !isYourTurn || newWordSubmitting || minigameSubmitting;
  playForm.querySelector("button").disabled = !isYourTurn || newWordSubmitting || minigameSubmitting;
  modeButtons.forEach((button) => {
    button.disabled = !isYourTurn || newWordSubmitting || minigameSubmitting;
  });
  const freeWord = room.minigame?.status === "won";
  const cost = freeWord ? 0 : room.newWordCost || 6;
  newWordButton.textContent = freeWord ? "Use free new word" : "New word · −6 pts";
  document.querySelector("#newWordHelp").textContent = freeWord ? "Your minigame win covers the cost. Choose a word and pass the turn." : "Spend 6 points and pass the turn to your opponent.";
  newWordForm.querySelector("button[type=submit]").textContent = freeWord ? "Play free new word" : "Spend 6 points";
  const canCreateWord = isYourTurn && you.score >= cost;
  newWordButton.disabled = !canCreateWord || newWordSubmitting || minigameSubmitting;
  newWordButton.title = canCreateWord
    ? `Spend ${cost} points to choose a new starting word and pass the turn`
    : `Available on your turn with at least ${cost} points`;
  newWordForm.querySelector("input").disabled = !canCreateWord || newWordSubmitting;
  newWordForm.querySelector("button[type=submit]").disabled = !canCreateWord || newWordSubmitting || minigameSubmitting;
  if (!canCreateWord) closeNewWordForm();
  minigameButton.disabled = !isYourTurn || room.minigameUsed || minigameSubmitting || newWordSubmitting;
  minigameButton.title = room.minigameUsed ? "One minigame attempt per turn" : "Play a 60-second word game to earn a free new word";
  document.querySelector("#startMinigameButton").disabled = minigameButton.disabled;
  minigameForm.querySelector("button").disabled = minigameSubmitting || room.status !== "minigame" || room.activePlayerId !== state.playerId;
  minigameForm.elements.word.disabled = room.status !== "minigame" || room.activePlayerId !== state.playerId;
  const playingMinigame = room.status === "minigame";
  playForm.classList.toggle("hidden", playingMinigame);
  document.querySelector("#modeSwitch").classList.toggle("hidden", playingMinigame);
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
