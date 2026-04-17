document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'fightcard:participants';
  const TOURNAMENT_KEY = 'fightcard:tournament';

  const form = document.getElementById('playerForm');
  const playerName = document.getElementById('playerName');
  const playerImage = document.getElementById('playerImage');
  const previewImage = document.getElementById('previewImage');
  const previewEmpty = document.getElementById('previewEmpty');
  const playerList = document.getElementById('playerList');
  const btnResetForm = document.getElementById('btnResetForm');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnSeedDummy = document.getElementById('btnSeedDummy');

  let currentImageData = '';

  function loadParticipants() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveParticipants(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    localStorage.removeItem(TOURNAMENT_KEY);
  }

  function createId() {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function resetForm() {
    form.reset();
    currentImageData = '';
    previewImage.hidden = true;
    previewImage.src = '';
    previewEmpty.hidden = false;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderList() {
    const participants = loadParticipants();

    if (participants.length === 0) {
      playerList.innerHTML = '<div class="empty-state">まだ参加者が登録されていません。<br>左のフォームから名前と顔写真を登録してください。</div>';
      return;
    }

    playerList.innerHTML = participants.map((player) => `
      <article class="player-item">
        <div class="player-item__thumb">
          <img src="${player.image}" alt="${escapeHtml(player.name)}" />
        </div>
        <div class="player-item__meta">
          <div class="player-item__name">${escapeHtml(player.name)}</div>
          <div class="player-item__id">${escapeHtml(player.id)}</div>
        </div>
        <div class="player-item__actions">
          <button class="ui-btn" type="button" data-delete-id="${player.id}">削除</button>
        </div>
      </article>
    `).join('');

    bindDeleteButtons();
  }

  function bindDeleteButtons() {
    playerList.querySelectorAll('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-delete-id');
        const next = loadParticipants().filter((player) => player.id !== id);
        saveParticipants(next);
        renderList();
      });
    });
  }

  function createDummyImage(name, colorA, colorB) {
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
        <g opacity="0.9">
          <ellipse cx="460" cy="250" rx="130" ry="120" fill="rgba(255,255,255,0.88)" />
          <path d="M300 520 C320 400, 390 330, 460 330 C530 330, 600 400, 620 520 Z" fill="rgba(255,255,255,0.88)" />
        </g>
        <text x="40" y="545" font-size="108" font-family="Impact, Arial Black, sans-serif" fill="rgba(255,255,255,0.24)" letter-spacing="4">${escapeHtml(name)}</text>
      </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  playerImage.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      currentImageData = '';
      previewImage.hidden = true;
      previewEmpty.hidden = false;
      return;
    }

    currentImageData = await readFileAsDataURL(file);
    previewImage.src = currentImageData;
    previewImage.hidden = false;
    previewEmpty.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = playerName.value.trim();
    if (!name) {
      alert('表示名を入力してください。');
      return;
    }

    if (!currentImageData) {
      const file = playerImage.files?.[0];
      if (!file) {
        alert('顔写真を選択してください。');
        return;
      }
      currentImageData = await readFileAsDataURL(file);
    }

    const next = [
      ...loadParticipants(),
      {
        id: createId(),
        name,
        image: currentImageData,
        createdAt: Date.now()
      }
    ];

    saveParticipants(next);
    renderList();
    resetForm();
  });

  btnResetForm.addEventListener('click', resetForm);

  btnClearAll.addEventListener('click', () => {
    if (!confirm('登録済み参加者をすべて削除します。よろしいですか？')) return;
    saveParticipants([]);
    renderList();
  });

  btnSeedDummy.addEventListener('click', () => {
    const samples = [
      ['TAKA', '#23d8ff', '#0f3f62'],
      ['YUJI', '#ff4f7d', '#5f1735'],
      ['AKIRA', '#ffd24a', '#704d00'],
      ['REI', '#8d7bff', '#2d2267']
    ].map(([name, a, b]) => ({
      id: createId(),
      name,
      image: createDummyImage(name, a, b),
      createdAt: Date.now()
    }));

    saveParticipants([...loadParticipants(), ...samples]);
    renderList();
  });

  renderList();
  resetForm();
});
