document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "fightcard:participants";

  const baseParticipants = [
    { id: "p1", name: "TAKA", colorA: "#23d8ff", colorB: "#0f3f62" },
    { id: "p2", name: "YUJI", colorA: "#ff4f7d", colorB: "#5f1735" },
    { id: "p3", name: "AKIRA", colorA: "#ffd24a", colorB: "#704d00" },
    { id: "p4", name: "REI", colorA: "#8d7bff", colorB: "#2d2267" },
    { id: "p5", name: "SHUN", colorA: "#45f0b2", colorB: "#0f4f3d" },
    { id: "p6", name: "MAKO", colorA: "#ff9855", colorB: "#6a2b0d" }
  ];

  const battleScreen = document.getElementById("battleScreen");
  const leftImage = document.getElementById("leftImage");
  const leftName = document.getElementById("leftName");
  const leftArtTitle = document.getElementById("leftArtTitle");
  const rightImage = document.getElementById("rightImage");
  const rightName = document.getElementById("rightName");
  const rightArtTitle = document.getElementById("rightArtTitle");
  const battleStatusValue = document.getElementById("battleStatusValue");
  const vsSubText = document.getElementById("vsSubText");
  const matchBanner = document.getElementById("matchBanner");
  const btnShuffleStart = document.getElementById("btnShuffleStart");
  const btnConfirm = document.getElementById("btnConfirm");
  const btnReset = document.getElementById("btnReset");

  const state = {
    phase: "idle",
    leftCurrent: null,
    rightCurrent: null,
    leftTimer: null,
    rightTimer: null,
    isBusy: false,
    participants: []
  };

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createFighterSvgDataUrl(name, colorA, colorB) {
    const safeName = escapeHtml(name);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${colorA}" />
            <stop offset="100%" stop-color="${colorB}" />
          </linearGradient>
        </defs>
        <rect width="900" height="600" fill="url(#bg)" />
        <rect width="900" height="600" fill="rgba(0,0,0,0.18)" />
        <g opacity="0.22">
          <path d="M0,120 L900,20 L900,90 L0,190 Z" fill="white"/>
          <path d="M0,340 L900,240 L900,300 L0,400 Z" fill="white"/>
          <path d="M0,520 L900,430 L900,490 L0,580 Z" fill="white"/>
        </g>
        <circle cx="670" cy="160" r="180" fill="rgba(255,255,255,0.16)" />
        <circle cx="700" cy="180" r="120" fill="rgba(255,255,255,0.10)" />
        <g opacity="0.9">
          <ellipse cx="460" cy="250" rx="130" ry="120" fill="rgba(255,255,255,0.88)" />
          <path d="M300 520 C320 400, 390 330, 460 330 C530 330, 600 400, 620 520 Z" fill="rgba(255,255,255,0.88)" />
        </g>
        <text x="40" y="545" font-size="108" font-family="Impact, Arial Black, sans-serif" fill="rgba(255,255,255,0.24)" letter-spacing="4">${safeName}</text>
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function getFallbackParticipants() {
    return baseParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      image: createFighterSvgDataUrl(p.name, p.colorA, p.colorB)
    }));
  }

  function loadStoredParticipants() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.id && item.name && item.image);
    } catch {
      return [];
    }
  }

  function getActiveParticipants() {
    return state.participants;
  }

  function refreshParticipants() {
    const stored = loadStoredParticipants();
    state.participants = stored.length >= 2 ? stored : getFallbackParticipants();
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function pickRandomExcluding(list, excludeIds = []) {
    const filtered = list.filter((item) => !excludeIds.includes(item.id));
    if (filtered.length === 0) return null;
    return randomItem(filtered);
  }

  function pickDistinctPair(list) {
    if (list.length < 2) {
      throw new Error("参加者は2人以上必要です。");
    }

    const left = randomItem(list);
    const right = pickRandomExcluding(list, [left.id]);

    if (!right) {
      throw new Error("重複しない組み合わせを作れません。");
    }

    return { left, right };
  }

  function renderSide(side, fighter) {
    if (!fighter) return;

    if (side === "left") {
      leftImage.src = fighter.image;
      leftImage.alt = fighter.name;
      leftName.textContent = fighter.name;
      leftArtTitle.textContent = fighter.name;
      state.leftCurrent = fighter;
    }

    if (side === "right") {
      rightImage.src = fighter.image;
      rightImage.alt = fighter.name;
      rightName.textContent = fighter.name;
      rightArtTitle.textContent = fighter.name;
      state.rightCurrent = fighter;
    }
  }

  function renderPair(left, right) {
    renderSide("left", left);
    renderSide("right", right);
  }

  function setPhase(phase) {
    state.phase = phase;
    battleScreen.classList.remove("is-idle", "is-shuffling", "is-locking", "is-confirmed");
    battleScreen.classList.add(`is-${phase}`);

    if (phase !== "confirmed") {
      matchBanner.hidden = true;
    }

    updateUiByPhase();
  }

  function updateUiByPhase() {
    switch (state.phase) {
      case "idle":
        battleStatusValue.textContent = "READY FOR NEXT BATTLE";
        vsSubText.textContent = "READY FOR NEXT BATTLE";
        btnShuffleStart.disabled = false;
        btnConfirm.disabled = true;
        btnReset.disabled = false;
        break;
      case "shuffling":
        battleStatusValue.textContent = "RANDOMIZING...";
        vsSubText.textContent = "RANDOMIZING...";
        btnShuffleStart.disabled = true;
        btnConfirm.disabled = false;
        btnReset.disabled = true;
        break;
      case "locking":
        battleStatusValue.textContent = "LOCKING IN...";
        vsSubText.textContent = "LOCKING IN...";
        btnShuffleStart.disabled = true;
        btnConfirm.disabled = true;
        btnReset.disabled = true;
        break;
      case "confirmed":
        battleStatusValue.textContent = "CARD LOCKED IN";
        vsSubText.textContent = "READY TO FIGHT";
        btnShuffleStart.disabled = false;
        btnConfirm.disabled = true;
        btnReset.disabled = false;
        matchBanner.hidden = false;
        break;
    }
  }

  function clearTimers() {
    clearInterval(state.leftTimer);
    clearInterval(state.rightTimer);
    state.leftTimer = null;
    state.rightTimer = null;
  }

  function tickLeft() {
    const list = getActiveParticipants();
    const excludeIds = state.rightCurrent ? [state.rightCurrent.id] : [];
    const next = pickRandomExcluding(list, excludeIds) || randomItem(list);
    renderSide("left", next);
  }

  function tickRight() {
    const list = getActiveParticipants();
    const excludeIds = state.leftCurrent ? [state.leftCurrent.id] : [];
    const next = pickRandomExcluding(list, excludeIds) || randomItem(list);
    renderSide("right", next);
  }

  function startShuffle() {
    refreshParticipants();
    const list = getActiveParticipants();
    if (state.isBusy) return;
    if (list.length < 2) {
      alert("参加者は2人以上必要です。");
      return;
    }
    if (state.phase === "shuffling" || state.phase === "locking") return;

    clearTimers();
    const initialPair = pickDistinctPair(list);
    renderPair(initialPair.left, initialPair.right);
    setPhase("shuffling");

    state.leftTimer = setInterval(tickLeft, 80);
    state.rightTimer = setInterval(tickRight, 110);
  }

  async function stopWithSlowdown(side, finalFighter, delays) {
    const list = getActiveParticipants();

    for (const delay of delays) {
      const opponent = side === "left" ? state.rightCurrent : state.leftCurrent;

      let preview = pickRandomExcluding(
        list,
        [opponent?.id, finalFighter.id].filter(Boolean)
      );

      if (!preview) {
        preview = pickRandomExcluding(list, [finalFighter.id]);
      }

      if (!preview) {
        preview = finalFighter;
      }

      renderSide(side, preview);
      await wait(delay);
    }

    renderSide(side, finalFighter);
  }

  async function confirmShuffle() {
    refreshParticipants();
    const list = getActiveParticipants();
    if (state.isBusy) return;
    if (list.length < 2) {
      alert("参加者は2人以上必要です。");
      return;
    }
    if (state.phase !== "shuffling") return;

    state.isBusy = true;
    setPhase("locking");
    clearTimers();

    const finalPair = pickDistinctPair(list);

    await Promise.all([
      stopWithSlowdown("left", finalPair.left, [90, 120, 160, 220]),
      stopWithSlowdown("right", finalPair.right, [110, 150, 190, 260])
    ]);

    setPhase("confirmed");

    await wait(50);
    battleScreen.classList.remove("is-confirmed");
    void battleScreen.offsetWidth;
    battleScreen.classList.add("is-confirmed");

    state.isBusy = false;
  }

  function resetBattle() {
    if (state.phase === "locking" || state.isBusy) return;
    clearTimers();
    refreshParticipants();

    const list = getActiveParticipants();
    if (list.length >= 2) {
      const pair = pickDistinctPair(list);
      renderPair(pair.left, pair.right);
    }

    setPhase("idle");
    matchBanner.hidden = true;
  }

  function init() {
    refreshParticipants();
    const list = getActiveParticipants();

    if (list.length >= 2) {
      const pair = pickDistinctPair(list);
      renderPair(pair.left, pair.right);
    }

    setPhase("idle");

    btnShuffleStart.addEventListener("click", startShuffle);
    btnConfirm.addEventListener("click", confirmShuffle);
    btnReset.addEventListener("click", resetBattle);

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) {
        refreshParticipants();
        if (state.phase === "idle") {
          resetBattle();
        }
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (state.phase === "idle" || state.phase === "confirmed") {
          startShuffle();
        }
      }

      if (event.code === "Enter") {
        event.preventDefault();
        if (state.phase === "shuffling") {
          confirmShuffle();
        }
      }
    });
  }

  init();
});
