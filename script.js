document.addEventListener("DOMContentLoaded", () => {
  const PARTICIPANT_KEY = "fightcard:participants";
  const TOURNAMENT_KEY = "fightcard:tournament";
  const DEFENDING_CHAMPION_KEY = "fightcard:defendingChampion";
  const SYNC_EVENT_KEY = "fightcard:sync";
  const DB_NAME = "fightcard-db";
  const DB_VERSION = 1;
  const PARTICIPANT_STORE = "participants";
  const SETTINGS_STORE = "settings";
  const syncChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("fightcard-sync") : null;

  const DEFAULT_DEFENDING_CHAMPION = {
    id: "defending-champion",
    name: "DEFENDING CHAMPION",
    title: "TITLE HOLDER",
    image: "",
    colorA: "#ffe45b",
    colorB: "#7a5300"
  };

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
  const championScreen = document.getElementById("championScreen");
  const championImage = document.getElementById("championImage");
  const championName = document.getElementById("championName");
  const championSub = document.getElementById("championSub");
  const btnChampionClose = document.getElementById("btnChampionClose");
  const btnChampionChallenge = document.getElementById("btnChampionChallenge");
  const btnChampionReset = document.getElementById("btnChampionReset");
  const challengeScreen = document.getElementById("challengeScreen");
  const challengeDefenderImage = document.getElementById("challengeDefenderImage");
  const challengeDefenderTitle = document.getElementById("challengeDefenderTitle");
  const challengeDefenderName = document.getElementById("challengeDefenderName");
  const challengeWinnerImage = document.getElementById("challengeWinnerImage");
  const challengeWinnerName = document.getElementById("challengeWinnerName");
  const challengeMessage = document.getElementById("challengeMessage");
  const btnChallengeClose = document.getElementById("btnChallengeClose");
  const btnChallengeReset = document.getElementById("btnChallengeReset");
  const btnChallengeWinnerDefender = document.getElementById("btnChallengeWinnerDefender");
  const btnChallengeWinnerChallenger = document.getElementById("btnChallengeWinnerChallenger");
  const winnerSpotlight = document.getElementById("winnerSpotlight");
  const winnerSpotlightImage = document.getElementById("winnerSpotlightImage");
  const winnerSpotlightName = document.getElementById("winnerSpotlightName");
  const winnerSpotlightEyebrow = document.getElementById("winnerSpotlightEyebrow");
  const winnerSpotlightTitle = document.getElementById("winnerSpotlightTitle");
  const winnerSpotlightSub = document.getElementById("winnerSpotlightSub");
  const btnWinnerSpotlightClose = document.getElementById("btnWinnerSpotlightClose");
  const btnWinnerSpotlightReset = document.getElementById("btnWinnerSpotlightReset");
  const btnShuffleStart = document.getElementById("btnShuffleStart");
  const btnConfirm = document.getElementById("btnConfirm");
  const btnReset = document.getElementById("btnReset");
  const btnTournament = document.getElementById("btnTournament");
  const tournamentInfo = document.getElementById("tournamentInfo");
  const tournamentActions = document.getElementById("tournamentActions");
  const btnWinnerLeft = document.getElementById("btnWinnerLeft");
  const btnWinnerRight = document.getElementById("btnWinnerRight");

  const tournamentModal = document.getElementById("tournamentModal");
  const tournamentBackdrop = document.getElementById("tournamentBackdrop");
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
    defendingChampion: null,
    tournament: null,
    scheduledMatch: null,
    revealScheduledMatch: false,
    specialChallenge: null,
    winnerOverlayAction: null,
    particlesFrame: null,
    bannerTimer: null,
    modalTimer: null,
    winnerTimer: null
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PARTICIPANT_STORE)) {
          db.createObjectStore(PARTICIPANT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadStoredDefendingChampion() {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, "readonly");
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.get("defendingChampion");
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onabort = tx.onerror = () => db.close();
      });
    } catch {
      return null;
    }
  }

  async function refreshChampion() {
    const stored = await loadStoredDefendingChampion();
    const champion = {
      ...DEFAULT_DEFENDING_CHAMPION,
      ...(stored || {}),
      name: String(stored?.name || DEFAULT_DEFENDING_CHAMPION.name).trim() || DEFAULT_DEFENDING_CHAMPION.name,
      title: String(stored?.title || DEFAULT_DEFENDING_CHAMPION.title).trim() || DEFAULT_DEFENDING_CHAMPION.title,
      image: typeof stored?.image === "string" ? stored.image : "",
      colorA: typeof stored?.colorA === "string" ? stored.colorA : DEFAULT_DEFENDING_CHAMPION.colorA,
      colorB: typeof stored?.colorB === "string" ? stored.colorB : DEFAULT_DEFENDING_CHAMPION.colorB
    };

    state.defendingChampion = {
      ...champion,
      image: champion.image || createFighterSvgDataUrl(
        champion.name,
        champion.colorA,
        champion.colorB
      )
    };
  }

  async function migrateLegacyDataIfNeeded() {
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction([PARTICIPANT_STORE, SETTINGS_STORE], "readwrite");
        const participantStore = tx.objectStore(PARTICIPANT_STORE);
        const settingsStore = tx.objectStore(SETTINGS_STORE);
        const participantCountRequest = participantStore.count();
        const championRequest = settingsStore.get("defendingChampion");

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("Legacy migration failed"));
        };
        tx.onabort = tx.onerror;

        participantCountRequest.onsuccess = () => {
          if (participantCountRequest.result === 0) {
            try {
              const rawParticipants = localStorage.getItem(PARTICIPANT_KEY);
              const parsedParticipants = rawParticipants ? JSON.parse(rawParticipants) : [];
              if (Array.isArray(parsedParticipants)) {
                parsedParticipants
                  .filter((item) => item && item.id && item.name && item.image)
                  .forEach((item) => participantStore.put(item));
              }
            } catch {}
          }
        };

        championRequest.onsuccess = () => {
          if (!championRequest.result?.value) {
            try {
              const rawChampion = localStorage.getItem(DEFENDING_CHAMPION_KEY);
              const parsedChampion = rawChampion ? JSON.parse(rawChampion) : null;
              if (parsedChampion && typeof parsedChampion === "object") {
                settingsStore.put({ key: "defendingChampion", value: parsedChampion });
              }
            } catch {}
          }
        };
      });
    } catch (error) {
      console.warn("Legacy storage migration skipped", error);
    }
  }

  function getDefendingChampion() {
    return state.defendingChampion || {
      ...DEFAULT_DEFENDING_CHAMPION,
      image: createFighterSvgDataUrl(
        DEFAULT_DEFENDING_CHAMPION.name,
        DEFAULT_DEFENDING_CHAMPION.colorA,
        DEFAULT_DEFENDING_CHAMPION.colorB
      )
    };
  }

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

  function createMysterySvgDataUrl(colorA, colorB) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${colorA}" />
            <stop offset="100%" stop-color="${colorB}" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="32%" r="60%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.22)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="900" height="1100" fill="url(#bg)" />
        <rect width="900" height="1100" fill="rgba(4,6,10,0.58)" />
        <rect width="900" height="1100" fill="url(#glow)" />
        <g opacity="0.14">
          <path d="M0 130 L900 0 L900 82 L0 214 Z" fill="white"/>
          <path d="M0 430 L900 300 L900 384 L0 514 Z" fill="white"/>
          <path d="M0 820 L900 660 L900 742 L0 904 Z" fill="white"/>
        </g>
        <g opacity="0.82" fill="rgba(255,255,255,0.88)">
          <ellipse cx="450" cy="330" rx="148" ry="154"/>
          <path d="M212 924 C244 704, 334 574, 450 574 C566 574, 656 704, 688 924 Z"/>
        </g>
        <text x="450" y="412" text-anchor="middle" font-size="250" font-family="Impact, Arial Black, sans-serif" fill="rgba(255,255,255,0.94)">?</text>
        <text x="450" y="1010" text-anchor="middle" font-size="180" font-family="Impact, Arial Black, sans-serif" fill="rgba(255,255,255,0.18)" letter-spacing="18">???</text>
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

  async function loadStoredParticipants() {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(PARTICIPANT_STORE, "readonly");
        const store = tx.objectStore(PARTICIPANT_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
          const rows = Array.isArray(request.result) ? request.result : [];
          rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          resolve(rows.filter((item) => item && item.id && item.name && item.image));
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onabort = tx.onerror = () => db.close();
      });
    } catch {
      return [];
    }
  }

  async function refreshParticipants() {
    const stored = await loadStoredParticipants();
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


  function pickPreviewPair(list, avoidIds = []) {
    const filtered = list.filter((item) => !avoidIds.includes(item.id));
    if (filtered.length >= 2) {
      const shuffled = shuffleArray(filtered);
      return { left: shuffled[0], right: shuffled[1] };
    }
    return pickDistinctPair(list);
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

  function renderMysteryPair(meta = {}) {
    const leftMystery = {
      id: "mystery-left",
      name: "???",
      image: createMysterySvgDataUrl("#23d8ff", "#0b1b2d")
    };
    const rightMystery = {
      id: "mystery-right",
      name: "???",
      image: createMysterySvgDataUrl("#ff4f7d", "#2b0b18")
    };
    renderPair(leftMystery, rightMystery, {
      leftBadge: meta.leftBadge || "SEALED",
      rightBadge: meta.rightBadge || "SEALED"
    });
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

  function isTournamentOpen() {
    return !tournamentModal.hidden;
  }

  function hideChampionScreen() {
    championScreen.hidden = true;
    championScreen.classList.remove("is-open");
  }

  function hideChallengeScreen() {
    challengeScreen.hidden = true;
    challengeScreen.classList.remove("is-open");
    state.specialChallenge = null;
  }

  async function hideWinnerSpotlight(runAction = true, actionType = "close") {
    clearTimeout(state.winnerTimer);
    battleScreen.classList.remove("is-winner-left", "is-winner-right");
    winnerSpotlight.hidden = true;
    winnerSpotlight.classList.remove("is-open", "winner-spotlight--finale");
    const action = state.winnerOverlayAction;
    state.winnerOverlayAction = null;
    if (!runAction || !action) return;
    if (actionType === "reset" && typeof action.onReset === "function") {
      await action.onReset();
      return;
    }
    if (typeof action.onClose === "function") {
      await action.onClose();
    }
  }

  function showWinnerSpotlight(winner, side, options = {}) {
    if (!winner) return;
    const {
      title = "WINNER",
      subtitle = `${winner.name} ADVANCES`,
      eyebrow = "MATCH WINNER",
      closeLabel = "閉じる",
      showReset = false,
      finale = false,
      onClose = null,
      onReset = null
    } = options;

    clearTimeout(state.winnerTimer);
    battleScreen.classList.remove("is-winner-left", "is-winner-right");
    battleScreen.classList.add(side === "left" ? "is-winner-left" : "is-winner-right");
    winnerSpotlightImage.src = winner.image;
    winnerSpotlightImage.alt = winner.name;
    winnerSpotlightName.textContent = winner.name;
    winnerSpotlightEyebrow.textContent = eyebrow;
    winnerSpotlightTitle.textContent = title;
    winnerSpotlightSub.textContent = subtitle;
    btnWinnerSpotlightClose.textContent = closeLabel;
    btnWinnerSpotlightReset.hidden = !showReset;
    winnerSpotlight.hidden = false;
    winnerSpotlight.classList.remove("is-open", "winner-spotlight--finale");
    if (finale) {
      winnerSpotlight.classList.add("winner-spotlight--finale");
    }
    state.winnerOverlayAction = { onClose, onReset };
    void winnerSpotlight.offsetWidth;
    winnerSpotlight.classList.add("is-open");
  }

  function showChampionScreen(champion) {
    if (!champion) return;
    hideChallengeScreen();
    championImage.src = champion.image;
    championImage.alt = champion.name;
    championName.textContent = champion.name;
    championSub.textContent = `${champion.name} IS THE LAST FIGHTER STANDING`;
    championScreen.hidden = false;
    championScreen.classList.remove("is-open");
    void championScreen.offsetWidth;
    championScreen.classList.add("is-open");
  }

  function showChallengeScreen(winner) {
    if (!winner) return;
    const defender = getDefendingChampion();
    hideChampionScreen();
    state.specialChallenge = { defender, challenger: winner };
    challengeDefenderImage.src = defender.image;
    challengeDefenderImage.alt = defender.name;
    challengeDefenderTitle.textContent = defender.title || DEFAULT_DEFENDING_CHAMPION.title;
    challengeDefenderName.textContent = defender.name;
    challengeWinnerImage.src = winner.image;
    challengeWinnerImage.alt = winner.name;
    challengeWinnerName.textContent = winner.name;
    challengeMessage.textContent = `${winner.name} EARNED THE RIGHT TO CHALLENGE ${defender.name}`;
    challengeScreen.hidden = false;
    challengeScreen.classList.remove("is-open");
    void challengeScreen.offsetWidth;
    challengeScreen.classList.add("is-open");
    showMatchBanner("SPECIAL TITLE MATCH", "CHAMPION CHALLENGE", true);
  }

  async function renderScheduledOrFallbackPair() {
    await refreshParticipants();
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
      if (state.revealScheduledMatch) {
        renderPair(state.scheduledMatch.left.player, state.scheduledMatch.right.player, {
          leftBadge: state.scheduledMatch.left.badge,
          rightBadge: state.scheduledMatch.right.badge
        });
      } else {
        renderMysteryPair({ leftBadge: "RANDOM DRAW", rightBadge: "RANDOM DRAW" });
      }
      return;
    }

    renderMysteryPair({ leftBadge: "UNKNOWN", rightBadge: "UNKNOWN" });
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
      if (champion) {
        showChampionScreen(champion);
      }
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

    hideChampionScreen();
    hideChallengeScreen();
    renderHudLabels();
    updateTournamentMeta();
  }

  function setPhase(phase) {
    state.phase = phase;
    battleScreen.classList.remove("is-idle", "is-shuffling", "is-locking", "is-confirmed");
    battleScreen.classList.add(`is-${phase}`);
    if (phase !== "confirmed") {
      hideMatchBanner();
      void hideWinnerSpotlight(false);
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
    const particles = Array.from({ length: 180 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 20;
      return {
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7 + Math.random() * 0.5,
        size: 1.8 + Math.random() * 4.8,
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
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.life -= 0.02 * dt;

        if (particle.life <= 0) return;

        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = Math.max(1, particle.size * 0.52);
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - particle.vx * 1.15, particle.y - particle.vy * 1.15);
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

  async function startShuffle() {
    await refreshParticipants();
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
    await hideWinnerSpotlight(false);
    renderMysteryPair({ leftBadge: state.tournament ? "RANDOM DRAW" : "UNKNOWN", rightBadge: state.tournament ? "RANDOM DRAW" : "UNKNOWN" });

    setPhase("shuffling");
    state.leftTimer = setInterval(tickLeft, 34);
    state.rightTimer = setInterval(tickRight, 61);
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
    await refreshParticipants();
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
      stopWithSlowdown("left", finalPair.left, finalPair.leftBadge, [36, 54, 74, 108, 160, 240]),
      stopWithSlowdown("right", finalPair.right, finalPair.rightBadge, [58, 82, 112, 156, 220, 320])
    ]);

    state.revealScheduledMatch = !!state.tournament;
    setPhase("confirmed");
    triggerConfirmFx(
      state.tournament ? "TOURNAMENT MATCH LOCKED IN" : "FIGHT CARD LOCKED IN",
      "MATCH CONFIRMED"
    );

    state.isBusy = false;
  }

  function shouldRevealBracketMatch(tournament, roundIndex, matchIndex) {
    const match = tournament?.rounds?.[roundIndex]?.matches?.[matchIndex];
    if (!match) return false;
    if (match.winnerId) return true;

    const current = getCurrentTournamentMatch(tournament);
    if (!current) return false;
    if (roundIndex < current.roundIndex) return true;
    if (roundIndex === current.roundIndex && matchIndex < current.matchIndex) return true;
    if (roundIndex === current.roundIndex && matchIndex === current.matchIndex) {
      return state.phase === "locking" || state.phase === "confirmed" || state.revealScheduledMatch;
    }
    return false;
  }

  function getSlotLabel(slot, tournament, options = {}) {
    const resolved = resolveSlot(slot, tournament);
    const reveal = options.reveal !== false;

    if (!reveal) {
      return {
        name: slot?.type === "winner" ? "WINNER TBD" : "RANDOM DRAW",
        tag: "SEALED"
      };
    }

    return {
      name: resolved.player?.name || (slot?.type === "winner" ? "WINNER TBD" : "TBD"),
      tag: resolved.badge
    };
  }

  async function renderTournamentBracket() {
    await refreshParticipants();
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
                const revealMatch = shouldRevealBracketMatch(state.tournament, roundIndex, matchIndex);
                const left = getSlotLabel(match.leftSlot, state.tournament, { reveal: revealMatch });
                const right = getSlotLabel(match.rightSlot, state.tournament, { reveal: revealMatch });
                const leftResolved = resolveSlot(match.leftSlot, state.tournament);
                const rightResolved = resolveSlot(match.rightSlot, state.tournament);
                const currentClass = current && current.roundIndex === roundIndex && current.matchIndex === matchIndex ? "is-current" : "";
                const sealedClass = !revealMatch && !match.winnerId ? "is-sealed" : "";
                const leftWinner = match.winnerId && leftResolved.player?.id === match.winnerId ? "is-winner" : "";
                const rightWinner = match.winnerId && rightResolved.player?.id === match.winnerId ? "is-winner" : "";
                const leftPending = revealMatch && !leftResolved.player ? "match-slot--pending" : "";
                const rightPending = revealMatch && !rightResolved.player ? "match-slot--pending" : "";
                const leftHidden = !revealMatch && !match.winnerId ? "match-slot--hidden" : "";
                const rightHidden = !revealMatch && !match.winnerId ? "match-slot--hidden" : "";
                return `
                  <article class="match-card ${currentClass} ${sealedClass}">
                    <div class="match-card__meta">MATCH ${matchIndex + 1}</div>
                    <div class="match-slot ${leftWinner} ${leftPending} ${leftHidden}">
                      <span class="match-slot__name">${escapeHtml(left.name)}</span>
                      <span class="match-slot__tag">${escapeHtml(left.tag)}</span>
                    </div>
                    <div class="match-slot ${rightWinner} ${rightPending} ${rightHidden}">
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

  async function startTournament() {
    await refreshParticipants();
    if (state.participants.length !== 13) {
      alert(`13人トーナメントは現在ちょうど13人で開始します。今は ${state.participants.length} 人です。`);
      return;
    }

    const tournament = buildTournament13(state.participants);
    state.revealScheduledMatch = false;
    saveTournament(tournament);
    refreshTournament();
    await renderScheduledOrFallbackPair();
    renderHudLabels();
    await renderTournamentBracket();
    setPhase("idle");
  }

  async function resetTournament() {
    if (!confirm("トーナメント表と進行状況をリセットします。よろしいですか？")) return;
    state.revealScheduledMatch = false;
    saveTournament(null);
    refreshTournament();
    await renderScheduledOrFallbackPair();
    renderHudLabels();
    await renderTournamentBracket();
    setPhase("idle");
  }

  async function openTournamentDialog() {
    await renderTournamentBracket();
    clearTimeout(state.modalTimer);
    tournamentModal.hidden = false;
    requestAnimationFrame(() => {
      tournamentModal.classList.add("is-open");
    });
  }

  function closeTournamentDialog() {
    clearTimeout(state.modalTimer);
    tournamentModal.classList.remove("is-open");
    state.modalTimer = setTimeout(() => {
      tournamentModal.hidden = true;
    }, 220);
  }

  async function selectWinner(side) {
    refreshTournament();
    if (state.isBusy || !state.tournament || !state.scheduledMatch || state.phase !== "confirmed") return;

    state.isBusy = true;
    const winner = side === "left" ? state.scheduledMatch.left.player : state.scheduledMatch.right.player;
    const round = state.tournament.rounds[state.scheduledMatch.roundIndex];
    const match = round.matches[state.scheduledMatch.matchIndex];
    match.winnerId = winner.id;

    const nextMatch = getCurrentTournamentMatch(state.tournament);
    const isFinal = !nextMatch;

    if (isFinal) {
      state.tournament.status = "complete";
    }

    saveTournament(state.tournament);
    await renderTournamentBracket();
    triggerConfirmFx(isFinal ? "TOURNAMENT RESULT" : "WINNER LOCKED IN", isFinal ? `${winner.name} WINS` : `${winner.name} ADVANCES`);
    showWinnerSpotlight(winner, side, {
      eyebrow: isFinal ? "GRAND WINNER" : "MATCH WINNER",
      title: isFinal ? "TOURNAMENT CHAMPION" : "WINNER",
      subtitle: isFinal ? `${winner.name} IS THE LAST FIGHTER STANDING` : `${winner.name} ADVANCES TO THE NEXT ROUND`,
      closeLabel: isFinal ? "優勝画面へ" : "次の試合へ",
      finale: isFinal,
      onClose: async () => {
        if (isFinal) {
          refreshTournament();
          await renderScheduledOrFallbackPair();
          updateUiByPhase();
          await renderTournamentBracket();
          state.isBusy = false;
          return;
        }

        refreshTournament();
        state.revealScheduledMatch = false;
        await renderScheduledOrFallbackPair();
        setPhase("idle");
        if (isTournamentOpen()) {
          await renderTournamentBracket();
        }
        state.isBusy = false;
      }
    });
  }

  async function selectSpecialBattleWinner(side) {
    if (state.isBusy || !state.specialChallenge) return;

    state.isBusy = true;
    const defender = state.specialChallenge.defender;
    const challenger = state.specialChallenge.challenger;
    const winner = side === "left" ? defender : challenger;

    renderPair(defender, challenger, {
      leftBadge: defender.title || "CHAMPION",
      rightBadge: "CHALLENGER"
    });
    triggerConfirmFx("WORLD TITLE DECIDED", `${winner.name} WINS THE MAIN EVENT`);
    showWinnerSpotlight(winner, side, {
      eyebrow: side === "left" ? "STILL THE CHAMPION" : "NEW CHAMPION",
      title: side === "left" ? "TITLE DEFENSE" : "NEW ERA",
      subtitle: side === "left" ? `${winner.name} DEFENDS THE BELT` : `${winner.name} CONQUERS THE CHAMPION`,
      closeLabel: "フィナーレを閉じる",
      showReset: true,
      finale: true,
      onClose: async () => {
        hideChallengeScreen();
        state.isBusy = false;
      },
      onReset: async () => {
        hideChallengeScreen();
        state.isBusy = false;
        await startNewTournamentFlow();
      }
    });
  }

  async function resetBattle() {
    if (state.phase === "locking" || state.isBusy) return;
    clearTimers();
    await hideWinnerSpotlight(false);
    state.revealScheduledMatch = false;
    await renderScheduledOrFallbackPair();
    if (state.tournament?.status === "complete") {
      updateUiByPhase();
      return;
    }
    setPhase("idle");
  }

  async function startNewTournamentFlow() {
    hideChampionScreen();
    hideChallengeScreen();
    await hideWinnerSpotlight(false);
    await resetTournament();
    closeTournamentDialog();
  }

  async function init() {
    await migrateLegacyDataIfNeeded();
    await refreshParticipants();
    await refreshChampion();
    refreshTournament();
    state.revealScheduledMatch = false;
    await renderScheduledOrFallbackPair();
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
    btnChampionClose.addEventListener("click", hideChampionScreen);
    btnChampionChallenge.addEventListener("click", async () => {
      await refreshChampion();
      const champion = getChampion(state.tournament);
      if (champion) showChallengeScreen(champion);
    });
    btnChampionReset.addEventListener("click", startNewTournamentFlow);
    btnChallengeClose.addEventListener("click", hideChallengeScreen);
    btnChallengeReset.addEventListener("click", startNewTournamentFlow);
    btnChallengeWinnerDefender.addEventListener("click", () => selectSpecialBattleWinner("left"));
    btnChallengeWinnerChallenger.addEventListener("click", () => selectSpecialBattleWinner("right"));
    btnWinnerSpotlightClose.addEventListener("click", async () => {
      await hideWinnerSpotlight(true, "close");
    });
    btnWinnerSpotlightReset.addEventListener("click", async () => {
      await hideWinnerSpotlight(true, "reset");
    });
    tournamentBackdrop.addEventListener("click", closeTournamentDialog);

    window.addEventListener("resize", resizeParticlesCanvas);
    window.addEventListener("storage", async (event) => {
      if (event.key === TOURNAMENT_KEY) {
        refreshTournament();
        await renderScheduledOrFallbackPair();
        updateUiByPhase();
        if (isTournamentOpen()) {
          await renderTournamentBracket();
        }
        return;
      }

      if (event.key === SYNC_EVENT_KEY) {
        await refreshParticipants();
        await refreshChampion();
        refreshTournament();
        await renderScheduledOrFallbackPair();
        updateUiByPhase();
        if (isTournamentOpen()) {
          await renderTournamentBracket();
        }
        if (!challengeScreen.hidden) {
          const champion = getChampion(state.tournament);
          if (champion) {
            showChallengeScreen(champion);
          }
        }
      }
    });

    syncChannel?.addEventListener("message", async () => {
      await refreshParticipants();
      await refreshChampion();
      refreshTournament();
      await renderScheduledOrFallbackPair();
      updateUiByPhase();
      if (isTournamentOpen()) {
        await renderTournamentBracket();
      }
      if (!challengeScreen.hidden) {
        const champion = getChampion(state.tournament);
        if (champion) {
          showChallengeScreen(champion);
        }
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;

      if (event.key === "Escape" && !winnerSpotlight.hidden) {
        event.preventDefault();
        void hideWinnerSpotlight(true, "close");
        return;
      }

      if (event.key === "Escape" && !challengeScreen.hidden) {
        event.preventDefault();
        hideChallengeScreen();
        return;
      }

      if (event.key === "Escape" && !championScreen.hidden) {
        event.preventDefault();
        hideChampionScreen();
        return;
      }

      if (event.key === "Escape" && isTournamentOpen()) {
        event.preventDefault();
        closeTournamentDialog();
        return;
      }

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
