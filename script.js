document.addEventListener("DOMContentLoaded", () => {
  const PARTICIPANT_KEY = "fightcard:participants";
  const TOURNAMENT_KEY = "fightcard:tournament";

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
  const leftBadge = document.getElementById("leftBadge");
  const rightImage = document.getElementById("rightImage");
  const rightName = document.getElementById("rightName");
  const rightArtTitle = document.getElementById("rightArtTitle");
  const rightBadge = document.getElementById("rightBadge");
  const battleStatusValue = document.getElementById("battleStatusValue");
  const vsSubText = document.getElementById("vsSubText");
  const roundLabel = document.getElementById("roundLabel");
  const matchLabel = document.getElementById("matchLabel");
  const matchBanner = document.getElementById("matchBanner");
  const matchBannerText = matchBanner.querySelector(".match-banner__text");
  const matchBannerEyebrow = matchBanner.querySelector(".match-banner__eyebrow");
  const btnShuffleStart = document.getElementById("btnShuffleStart");
  const btnConfirm = document.getElementById("btnConfirm");
  const btnReset = document.getElementById("btnReset");
  const btnTournament = document.getElementById("btnTournament");
  const tournamentInfo = document.getElementById("tournamentInfo");
  const tournamentActions = document.getElementById("tournamentActions");
  const btnWinnerLeft = document.getElementById("btnWinnerLeft");
  const btnWinnerRight = document.getElementById("btnWinnerRight");

  const tournamentDialog = document.getElementById("tournamentDialog");
  const tournamentBody = document.getElementById("tournamentBody");
  const btnTournamentClose = document.getElementById("btnTournamentClose");
  const btnTournamentReset = document.getElementById("btnTournamentReset");

  const canvas = document.getElementById("fxParticles");
  const ctx = canvas?.getContext("2d");

  const state = {
    phase: "idle",
    leftCurrent: null,
    rightCurrent: null,
    leftTimer: null,
    rightTimer: null,
    isBusy: false,
    participants: [],
    tournament: null,
    scheduledMatch: null,
    particlesFrame: null,
    bannerTimer: null
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
    return baseParticipants.map((player) => ({
      id: player.id,
      name: player.name,
      image: createFighterSvgDataUrl(player.name, player.colorA, player.colorB)
    }));
  }

  function loadStoredParticipants() {
    try {
      const raw = localStorage.getItem(PARTICIPANT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.id && item.name && item.image);
    } catch {
      return [];
    }
  }

  function refreshParticipants() {
    const stored = loadStoredParticipants();
    state.participants = stored.length >= 2 ? stored : getFallbackParticipants();
  }

  function getParticipantById(id) {
    return state.participants.find((item) => item.id === id) || null;
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffleArray(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

  function loadTournament() {
    try {
      const raw = localStorage.getItem(TOURNAMENT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && Array.isArray(parsed.rounds) ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveTournament(tournament) {
    state.tournament = tournament;
    if (tournament) {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(tournament));
    } else {
      localStorage.removeItem(TOURNAMENT_KEY);
    }
  }

  function makeMatch(id, leftSlot, rightSlot) {
    return { id, leftSlot, rightSlot, winnerId: null };
  }

  function buildTournament13(players) {
    if (players.length !== 13) {
      throw new Error("13人ちょうどでトーナメントを開始してください。");
    }

    const ids = shuffleArray(players.map((player) => player.id));
    const seeds = ids.slice(0, 3);
    const round1Ids = ids.slice(3);

    return {
      mode: "13-single-elimination",
      createdAt: Date.now(),
      status: "active",
      rounds: [
        {
          label: "ROUND 1",
          matches: [
            makeMatch("r1m1", { type: "player", playerId: round1Ids[0] }, { type: "player", playerId: round1Ids[1] }),
            makeMatch("r1m2", { type: "player", playerId: round1Ids[2] }, { type: "player", playerId: round1Ids[3] }),
            makeMatch("r1m3", { type: "player", playerId: round1Ids[4] }, { type: "player", playerId: round1Ids[5] }),
            makeMatch("r1m4", { type: "player", playerId: round1Ids[6] }, { type: "player", playerId: round1Ids[7] }),
            makeMatch("r1m5", { type: "player", playerId: round1Ids[8] }, { type: "player", playerId: round1Ids[9] })
          ]
        },
        {
          label: "ROUND 2",
          matches: [
            makeMatch("r2m1", { type: "seed", playerId: seeds[0], badge: "SEED" }, { type: "winner", roundIndex: 0, matchIndex: 0 }),
            makeMatch("r2m2", { type: "seed", playerId: seeds[1], badge: "SEED" }, { type: "winner", roundIndex: 0, matchIndex: 1 }),
            makeMatch("r2m3", { type: "seed", playerId: seeds[2], badge: "SEED" }, { type: "winner", roundIndex: 0, matchIndex: 2 }),
            makeMatch("r2m4", { type: "winner", roundIndex: 0, matchIndex: 3 }, { type: "winner", roundIndex: 0, matchIndex: 4 })
          ]
        },
        {
          label: "SEMI FINAL",
          matches: [
            makeMatch("r3m1", { type: "winner", roundIndex: 1, matchIndex: 0 }, { type: "winner", roundIndex: 1, matchIndex: 1 }),
            makeMatch("r3m2", { type: "winner", roundIndex: 1, matchIndex: 2 }, { type: "winner", roundIndex: 1, matchIndex: 3 })
          ]
        },
        {
          label: "FINAL",
          matches: [
            makeMatch("r4m1", { type: "winner", roundIndex: 2, matchIndex: 0 }, { type: "winner", roundIndex: 2, matchIndex: 1 })
          ]
        }
      ]
    };
  }

  function resolveSlot(slot, tournament) {
    if (!slot) {
      return { player: null, badge: "TBD" };
    }

    if (slot.type === "player" || slot.type === "seed") {
      return {
        player: getParticipantById(slot.playerId),
        badge: slot.badge || (slot.type === "seed" ? "SEED" : "PLAYER")
      };
    }

    if (slot.type === "winner") {
      const match = tournament?.rounds?.[slot.roundIndex]?.matches?.[slot.matchIndex];
      if (!match || !match.winnerId) {
        return { player: null, badge: "WINNER" };
      }
      return {
        player: getParticipantById(match.winnerId),
        badge: "WINNER"
      };
    }

    return { player: null, badge: "TBD" };
  }

  function getCurrentTournamentMatch(tournament) {
    if (!tournament || !Array.isArray(tournament.rounds)) return null;

    for (let roundIndex = 0; roundIndex < tournament.rounds.length; roundIndex += 1) {
      const round = tournament.rounds[roundIndex];
      for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex += 1) {
        const match = round.matches[matchIndex];
        if (match.winnerId) continue;

        const left = resolveSlot(match.leftSlot, tournament);
        const right = resolveSlot(match.rightSlot, tournament);

        if (left.player && right.player) {
          return { roundIndex, matchIndex, round, match, left, right };
        }
      }
    }

    return null;
  }

  function getChampion(tournament) {
    const finalMatch = tournament?.rounds?.[tournament.rounds.length - 1]?.matches?.[0];
    return finalMatch?.winnerId ? getParticipantById(finalMatch.winnerId) : null;
  }

  function getFinalResolvedPair(tournament) {
    const finalMatch = tournament?.rounds?.[tournament.rounds.length - 1]?.matches?.[0];
    if (!finalMatch) return null;
    const left = resolveSlot(finalMatch.leftSlot, tournament);
    const right = resolveSlot(finalMatch.rightSlot, tournament);
    if (!left.player || !right.player) return null;
    return {
      left: left.player,
      right: right.player,
      leftBadge: finalMatch.winnerId === left.player.id ? "CHAMPION" : "FINALIST",
      rightBadge: finalMatch.winnerId === right.player.id ? "CHAMPION" : "FINALIST"
    };
  }

  function refreshTournament() {
    state.tournament = loadTournament();
    if (!state.tournament || state.tournament.status === "complete") {
      state.scheduledMatch = null;
      return;
    }
    state.scheduledMatch = getCurrentTournamentMatch(state.tournament);
  }

  function renderSide(side, fighter, badgeText = null) {
    if (!fighter) return;

    if (side === "left") {
      leftImage.src = fighter.image;
      leftImage.alt = fighter.name;
      leftName.textContent = fighter.name;
      leftArtTitle.textContent = fighter.name;
      leftBadge.textContent = badgeText || "PLAYER 1";
      state.leftCurrent = fighter;
      return;
    }

    rightImage.src = fighter.image;
    rightImage.alt = fighter.name;
    rightName.textContent = fighter.name;
    rightArtTitle.textContent = fighter.name;
    rightBadge.textContent = badgeText || "PLAYER 2";
    state.rightCurrent = fighter;
  }

  function renderPair(left, right, meta = {}) {
    renderSide("left", left, meta.leftBadge);
    renderSide("right", right, meta.rightBadge);
  }

  function hideMatchBanner() {
    clearTimeout(state.bannerTimer);
    matchBanner.classList.remove("is-active");
    matchBanner.hidden = true;
  }

  function showMatchBanner(eyebrow, text, animate = true) {
    clearTimeout(state.bannerTimer);
    matchBannerEyebrow.textContent = eyebrow;
    matchBannerText.textContent = text;
    matchBanner.hidden = false;
    matchBanner.classList.remove("is-active");
    if (animate) {
      void matchBanner.offsetWidth;
      matchBanner.classList.add("is-active");
      state.bannerTimer = setTimeout(() => {
        matchBanner.classList.remove("is-active");
      }, 900);
    }
  }

  function renderScheduledOrFallbackPair() {
    refreshParticipants();
    refreshTournament();

    if (state.tournament?.status === "complete") {
      const finalPair = getFinalResolvedPair(state.tournament);
      if (finalPair) {
        renderPair(finalPair.left, finalPair.right, {
          leftBadge: finalPair.leftBadge,
          rightBadge: finalPair.rightBadge
        });
      }
      return;
    }

    if (state.tournament && state.scheduledMatch) {
      renderPair(state.scheduledMatch.left.player, state.scheduledMatch.right.player, {
        leftBadge: state.scheduledMatch.left.badge,
        rightBadge: state.scheduledMatch.right.badge
      });
      return;
    }

    if (state.participants.length >= 2) {
      const pair = pickDistinctPair(state.participants);
      renderPair(pair.left, pair.right);
    }
  }

  function renderHudLabels() {
    refreshTournament();

    if (state.tournament && state.scheduledMatch) {
      roundLabel.textContent = state.scheduledMatch.round.label;
      matchLabel.textContent = `MATCH ${state.scheduledMatch.matchIndex + 1} / ${state.scheduledMatch.round.matches.length}`;
      btnTournament.textContent = "トーナメント進行中";
      return;
    }

    if (state.tournament?.status === "complete") {
      roundLabel.textContent = "FINAL";
      matchLabel.textContent = "COMPLETE";
      btnTournament.textContent = "トーナメント結果";
      return;
    }

    roundLabel.textContent = "ROUND 01";
    matchLabel.textContent = "RANDOM MATCH";
    btnTournament.textContent = "トーナメント";
  }

  function updateTournamentMeta() {
    if (state.tournament?.status === "complete") {
      tournamentInfo.textContent = "TOURNAMENT COMPLETE";
      tournamentActions.hidden = true;
      return;
    }

    if (state.tournament && state.scheduledMatch) {
      tournamentInfo.textContent = `${state.scheduledMatch.round.label} / MATCH ${state.scheduledMatch.matchIndex + 1}`;
      tournamentActions.hidden = state.phase !== "confirmed";
      return;
    }

    tournamentInfo.textContent = "RANDOM MODE";
    tournamentActions.hidden = true;
  }

  function updateUiByPhase() {
    if (state.tournament?.status === "complete") {
      const champion = getChampion(state.tournament);
      battleStatusValue.textContent = champion ? `CHAMPION ${champion.name}` : "TOURNAMENT COMPLETE";
      vsSubText.textContent = champion ? "TOURNAMENT COMPLETE" : "READY";
      btnShuffleStart.disabled = true;
      btnConfirm.disabled = true;
      btnReset.disabled = false;
      renderHudLabels();
      updateTournamentMeta();
      return;
    }

    switch (state.phase) {
      case "idle":
        battleStatusValue.textContent = state.tournament ? "READY FOR NEXT TOURNAMENT MATCH" : "READY FOR NEXT BATTLE";
        vsSubText.textContent = state.tournament ? "TOURNAMENT MATCH READY" : "READY FOR NEXT BATTLE";
        btnShuffleStart.disabled = false;
        btnConfirm.disabled = true;
        btnReset.disabled = false;
        break;
      case "shuffling":
        battleStatusValue.textContent = state.tournament ? "LOCKING TO BRACKET MATCH..." : "RANDOMIZING...";
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
        battleStatusValue.textContent = state.tournament ? "SELECT WINNER" : "CARD LOCKED IN";
        vsSubText.textContent = state.tournament ? "MATCH CONFIRMED / PICK WINNER" : "READY TO FIGHT";
        btnShuffleStart.disabled = !!state.tournament;
        btnConfirm.disabled = true;
        btnReset.disabled = false;
        break;
    }

    renderHudLabels();
    updateTournamentMeta();
  }

  function setPhase(phase) {
    state.phase = phase;
    battleScreen.classList.remove("is-idle", "is-shuffling", "is-locking", "is-confirmed");
    battleScreen.classList.add(`is-${phase}`);
    if (phase !== "confirmed") {
      hideMatchBanner();
    }
    updateUiByPhase();
  }

  function clearTimers() {
    clearInterval(state.leftTimer);
    clearInterval(state.rightTimer);
    state.leftTimer = null;
    state.rightTimer = null;
  }

  function resizeParticlesCanvas() {
    if (!canvas || !ctx) return;
    const rect = battleScreen.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function playParticles() {
    if (!canvas || !ctx) return;

    cancelAnimationFrame(state.particlesFrame);
    resizeParticlesCanvas();

    const rect = battleScreen.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const colors = ["#ffe45b", "#ffffff", "#2dd7ff", "#ff3d68", "#ff8a5b"];
    const particles = Array.from({ length: 150 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 18;
      return {
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.75 + Math.random() * 0.45,
        size: 1.8 + Math.random() * 4.2,
        length: 12 + Math.random() * 24,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });

    let last = performance.now();

    function frame(now) {
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      ctx.clearRect(0, 0, rect.width, rect.height);

      particles.forEach((particle) => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.986;
        particle.vy *= 0.986;
        particle.life -= 0.02 * dt;

        if (particle.life <= 0) return;

        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = Math.max(1, particle.size * 0.55);
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - particle.vx * 0.85, particle.y - particle.vy * 0.85);
        ctx.stroke();

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;

      if (particles.some((particle) => particle.life > 0)) {
        state.particlesFrame = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    }

    state.particlesFrame = requestAnimationFrame(frame);
  }

  function triggerConfirmFx(eyebrow, text) {
    battleScreen.classList.remove("is-confirmed");
    void battleScreen.offsetWidth;
    battleScreen.classList.add("is-confirmed");
    showMatchBanner(eyebrow, text, true);
    playParticles();
  }

  function tickLeft() {
    const opponentId = state.rightCurrent?.id ? [state.rightCurrent.id] : [];
    const next = pickRandomExcluding(state.participants, opponentId) || randomItem(state.participants);
    renderSide("left", next, leftBadge.textContent);
  }

  function tickRight() {
    const opponentId = state.leftCurrent?.id ? [state.leftCurrent.id] : [];
    const next = pickRandomExcluding(state.participants, opponentId) || randomItem(state.participants);
    renderSide("right", next, rightBadge.textContent);
  }

  function startShuffle() {
    refreshParticipants();
    refreshTournament();

    if (state.isBusy) return;
    if (state.phase === "shuffling" || state.phase === "locking") return;
    if (state.participants.length < 2) {
      alert("参加者は2人以上必要です。");
      return;
    }
    if (state.tournament && !state.scheduledMatch && state.tournament.status !== "complete") {
      alert("次に進める対戦カードがありません。トーナメント表を確認してください。");
      return;
    }

    clearTimers();
    hideMatchBanner();

    if (state.tournament && state.scheduledMatch) {
      renderPair(state.scheduledMatch.left.player, state.scheduledMatch.right.player, {
        leftBadge: state.scheduledMatch.left.badge,
        rightBadge: state.scheduledMatch.right.badge
      });
    } else {
      const pair = pickDistinctPair(state.participants);
      renderPair(pair.left, pair.right, { leftBadge: "PLAYER 1", rightBadge: "PLAYER 2" });
    }

    setPhase("shuffling");
    state.leftTimer = setInterval(tickLeft, 70);
    state.rightTimer = setInterval(tickRight, 96);
  }

  async function stopWithSlowdown(side, finalFighter, finalBadge, delays) {
    const list = state.participants;
    for (const delay of delays) {
      const opponent = side === "left" ? state.rightCurrent : state.leftCurrent;
      let preview = pickRandomExcluding(list, [opponent?.id, finalFighter.id].filter(Boolean));
      if (!preview) preview = pickRandomExcluding(list, [finalFighter.id]);
      if (!preview) preview = finalFighter;
      renderSide(side, preview, finalBadge);
      await wait(delay);
    }
    renderSide(side, finalFighter, finalBadge);
  }

  async function confirmShuffle() {
    refreshParticipants();
    refreshTournament();

    if (state.isBusy || state.phase !== "shuffling") return;
    if (state.participants.length < 2) {
      alert("参加者は2人以上必要です。");
      return;
    }

    state.isBusy = true;
    clearTimers();
    setPhase("locking");

    let finalPair;
    if (state.tournament && state.scheduledMatch) {
      finalPair = {
        left: state.scheduledMatch.left.player,
        right: state.scheduledMatch.right.player,
        leftBadge: state.scheduledMatch.left.badge,
        rightBadge: state.scheduledMatch.right.badge
      };
    } else {
      const pair = pickDistinctPair(state.participants);
      finalPair = { ...pair, leftBadge: "PLAYER 1", rightBadge: "PLAYER 2" };
    }

    await Promise.all([
      stopWithSlowdown("left", finalPair.left, finalPair.leftBadge, [80, 110, 150, 210, 290]),
      stopWithSlowdown("right", finalPair.right, finalPair.rightBadge, [95, 130, 170, 240, 320])
    ]);

    setPhase("confirmed");
    triggerConfirmFx(
      state.tournament ? "TOURNAMENT MATCH LOCKED IN" : "FIGHT CARD LOCKED IN",
      "MATCH CONFIRMED"
    );

    state.isBusy = false;
  }

  function getSlotLabel(slot, tournament) {
    const resolved = resolveSlot(slot, tournament);
    return {
      name: resolved.player?.name || (slot?.type === "winner" ? "WINNER TBD" : "TBD"),
      tag: resolved.badge
    };
  }

  function renderTournamentBracket() {
    refreshParticipants();
    refreshTournament();

    if (!state.tournament) {
      tournamentBody.innerHTML = `
        <div class="tournament-empty">
          まだトーナメントは作成されていません。<br>
          13人登録済みなら、ここから <strong>13人トーナメント</strong> を開始できます。<br><br>
          <button class="ui-btn ui-btn--primary" id="btnTournamentStart">13人トーナメント開始</button>
        </div>
      `;
      document.getElementById("btnTournamentStart")?.addEventListener("click", startTournament);
      return;
    }

    const current = getCurrentTournamentMatch(state.tournament);
    const champion = getChampion(state.tournament);

    tournamentBody.innerHTML = `
      <div class="tournament-rounds">
        ${champion ? `<div class="battle-status"><span class="battle-status__label">CHAMPION</span><strong class="battle-status__value">${escapeHtml(champion.name)}</strong></div>` : ""}
        ${state.tournament.rounds.map((round, roundIndex) => `
          <section class="tournament-round">
            <div class="tournament-round__head">
              <h3 class="tournament-round__title">${escapeHtml(round.label)}</h3>
              <span class="pill">${round.matches.length} MATCHES</span>
            </div>
            <div class="tournament-round__matches">
              ${round.matches.map((match, matchIndex) => {
                const left = getSlotLabel(match.leftSlot, state.tournament);
                const right = getSlotLabel(match.rightSlot, state.tournament);
                const leftResolved = resolveSlot(match.leftSlot, state.tournament);
                const rightResolved = resolveSlot(match.rightSlot, state.tournament);
                const currentClass = current && current.roundIndex === roundIndex && current.matchIndex === matchIndex ? "is-current" : "";
                const leftWinner = match.winnerId && leftResolved.player?.id === match.winnerId ? "is-winner" : "";
                const rightWinner = match.winnerId && rightResolved.player?.id === match.winnerId ? "is-winner" : "";
                const leftPending = !leftResolved.player ? "match-slot--pending" : "";
                const rightPending = !rightResolved.player ? "match-slot--pending" : "";
                return `
                  <article class="match-card ${currentClass}">
                    <div class="match-card__meta">MATCH ${matchIndex + 1}</div>
                    <div class="match-slot ${leftWinner} ${leftPending}">
                      <span class="match-slot__name">${escapeHtml(left.name)}</span>
                      <span class="match-slot__tag">${escapeHtml(left.tag)}</span>
                    </div>
                    <div class="match-slot ${rightWinner} ${rightPending}">
                      <span class="match-slot__name">${escapeHtml(right.name)}</span>
                      <span class="match-slot__tag">${escapeHtml(right.tag)}</span>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function startTournament() {
    refreshParticipants();
    if (state.participants.length !== 13) {
      alert(`13人トーナメントは現在ちょうど13人で開始します。今は ${state.participants.length} 人です。`);
      return;
    }

    const tournament = buildTournament13(state.participants);
    saveTournament(tournament);
    refreshTournament();
    renderScheduledOrFallbackPair();
    renderHudLabels();
    renderTournamentBracket();
    setPhase("idle");
  }

  function resetTournament() {
    if (!confirm("トーナメント表と進行状況をリセットします。よろしいですか？")) return;
    saveTournament(null);
    refreshTournament();
    renderScheduledOrFallbackPair();
    renderHudLabels();
    renderTournamentBracket();
    setPhase("idle");
  }

  function openTournamentDialog() {
    renderTournamentBracket();
    if (typeof tournamentDialog.showModal === "function") {
      tournamentDialog.showModal();
    }
  }

  function closeTournamentDialog() {
    if (tournamentDialog.open) {
      tournamentDialog.close();
    }
  }

  function selectWinner(side) {
    refreshTournament();
    if (!state.tournament || !state.scheduledMatch || state.phase !== "confirmed") return;

    const winner = side === "left" ? state.scheduledMatch.left.player : state.scheduledMatch.right.player;
    const round = state.tournament.rounds[state.scheduledMatch.roundIndex];
    const match = round.matches[state.scheduledMatch.matchIndex];
    match.winnerId = winner.id;

    const nextMatch = getCurrentTournamentMatch(state.tournament);

    if (!nextMatch) {
      state.tournament.status = "complete";
      saveTournament(state.tournament);
      refreshTournament();
      renderScheduledOrFallbackPair();
      updateUiByPhase();
      triggerConfirmFx("TOURNAMENT RESULT", `${winner.name} WINS`);
      renderTournamentBracket();
      return;
    }

    saveTournament(state.tournament);
    renderTournamentBracket();
    triggerConfirmFx("WINNER LOCKED IN", `${winner.name} ADVANCES`);

    setTimeout(() => {
      refreshTournament();
      renderScheduledOrFallbackPair();
      setPhase("idle");
      if (tournamentDialog.open) {
        renderTournamentBracket();
      }
    }, 900);
  }

  function resetBattle() {
    if (state.phase === "locking" || state.isBusy) return;
    clearTimers();
    if (state.tournament?.status === "complete") {
      renderScheduledOrFallbackPair();
      updateUiByPhase();
      return;
    }
    renderScheduledOrFallbackPair();
    setPhase("idle");
  }

  function init() {
    refreshParticipants();
    refreshTournament();
    renderScheduledOrFallbackPair();
    renderHudLabels();
    setPhase("idle");
    resizeParticlesCanvas();

    btnShuffleStart.addEventListener("click", startShuffle);
    btnConfirm.addEventListener("click", confirmShuffle);
    btnReset.addEventListener("click", resetBattle);
    btnTournament.addEventListener("click", openTournamentDialog);
    btnTournamentClose.addEventListener("click", closeTournamentDialog);
    btnTournamentReset.addEventListener("click", resetTournament);
    btnWinnerLeft.addEventListener("click", () => selectWinner("left"));
    btnWinnerRight.addEventListener("click", () => selectWinner("right"));

    window.addEventListener("resize", resizeParticlesCanvas);
    window.addEventListener("storage", (event) => {
      if (event.key === PARTICIPANT_KEY || event.key === TOURNAMENT_KEY) {
        refreshParticipants();
        refreshTournament();
        renderScheduledOrFallbackPair();
        updateUiByPhase();
        if (tournamentDialog.open) {
          renderTournamentBracket();
        }
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (state.phase === "idle") startShuffle();
      }

      if (event.code === "Enter") {
        event.preventDefault();
        if (state.phase === "shuffling") confirmShuffle();
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        openTournamentDialog();
      }
    });
  }

  init();
});
