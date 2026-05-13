document.addEventListener('DOMContentLoaded', () => {
  const TOURNAMENT_KEY = 'fightcard:tournament';
  const LEGACY_PARTICIPANT_KEY = 'fightcard:participants';
  const LEGACY_CHAMPION_KEY = 'fightcard:defendingChampion';
  const SYNC_EVENT_KEY = 'fightcard:sync';
  const DB_NAME = 'fightcard-db';
  const DB_VERSION = 1;
  const PARTICIPANT_STORE = 'participants';
  const SETTINGS_STORE = 'settings';
  const CHAMPION_SETTING_KEY = 'defendingChampion';
  const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fightcard-sync') : null;

  const DEFAULT_DEFENDING_CHAMPION = {
    id: 'defending-champion',
    name: 'DEFENDING CHAMPION',
    title: 'TITLE HOLDER',
    image: '',
    colorA: '#ffe45b',
    colorB: '#7a5300'
  };

  const championForm = document.getElementById('championForm');
  const championName = document.getElementById('championName');
  const championTitle = document.getElementById('championTitle');
  const championImage = document.getElementById('championImage');
  const championPreviewImage = document.getElementById('championPreviewImage');
  const championPreviewEmpty = document.getElementById('championPreviewEmpty');
  const championPreviewNameText = document.getElementById('championPreviewNameText');
  const championPreviewTitleText = document.getElementById('championPreviewTitleText');
  const btnChampionResetForm = document.getElementById('btnChampionResetForm');

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
  let currentChampionImageData = '';

  function notifyDataChanged(type) {
    const payload = JSON.stringify({ type, ts: Date.now() });
    try {
      localStorage.setItem(SYNC_EVENT_KEY, payload);
    } catch {}
    try {
      syncChannel?.postMessage({ type, ts: Date.now() });
    } catch {}
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PARTICIPANT_STORE)) {
          db.createObjectStore(PARTICIPANT_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(storeName, mode, handler) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try {
        result = handler(store, tx);
      } catch (error) {
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    }).finally(() => db.close());
  }

  async function loadParticipants() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PARTICIPANT_STORE, 'readonly');
      const store = tx.objectStore(PARTICIPANT_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = Array.isArray(request.result) ? request.result : [];
        rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        resolve(rows);
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onabort = tx.onerror = () => db.close();
    });
  }

  async function addParticipant(player) {
    try {
      await withStore(PARTICIPANT_STORE, 'readwrite', (store) => {
        store.put(player);
      });
      localStorage.removeItem(TOURNAMENT_KEY);
      notifyDataChanged('participants');
      return true;
    } catch (error) {
      console.error('Failed to save participant', error);
      alert('参加者の保存に失敗しました。ブラウザ容量の上限、またはプライベートモードの制限の可能性があります。');
      return false;
    }
  }

  async function removeParticipant(id) {
    await withStore(PARTICIPANT_STORE, 'readwrite', (store) => {
      store.delete(id);
    });
    localStorage.removeItem(TOURNAMENT_KEY);
    notifyDataChanged('participants');
  }

  async function clearParticipants() {
    await withStore(PARTICIPANT_STORE, 'readwrite', (store) => {
      store.clear();
    });
    localStorage.removeItem(TOURNAMENT_KEY);
    notifyDataChanged('participants');
  }

  async function addParticipants(players) {
    try {
      await withStore(PARTICIPANT_STORE, 'readwrite', (store) => {
        players.forEach((player) => store.put(player));
      });
      localStorage.removeItem(TOURNAMENT_KEY);
      notifyDataChanged('participants');
      return true;
    } catch (error) {
      console.error('Failed to save sample participants', error);
      alert('サンプル参加者の保存に失敗しました。');
      return false;
    }
  }

  async function loadChampion() {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readonly');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.get(CHAMPION_SETTING_KEY);
        request.onsuccess = () => {
          const row = request.result?.value;
          if (!row || typeof row !== 'object') {
            resolve({ ...DEFAULT_DEFENDING_CHAMPION });
            return;
          }
          resolve({
            ...DEFAULT_DEFENDING_CHAMPION,
            ...row,
            name: String(row.name || DEFAULT_DEFENDING_CHAMPION.name).trim() || DEFAULT_DEFENDING_CHAMPION.name,
            title: String(row.title || DEFAULT_DEFENDING_CHAMPION.title).trim() || DEFAULT_DEFENDING_CHAMPION.title,
            image: typeof row.image === 'string' ? row.image : ''
          });
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onabort = tx.onerror = () => db.close();
      });
    } catch {
      return { ...DEFAULT_DEFENDING_CHAMPION };
    }
  }

  async function saveChampion(data) {
    try {
      await withStore(SETTINGS_STORE, 'readwrite', (store) => {
        store.put({
          key: CHAMPION_SETTING_KEY,
          value: {
            ...DEFAULT_DEFENDING_CHAMPION,
            ...data,
            updatedAt: Date.now()
          }
        });
      });
      notifyDataChanged('champion');
      return true;
    } catch (error) {
      console.error('Failed to save champion', error);
      alert('王者画像の保存に失敗しました。');
      return false;
    }
  }

  async function clearChampion() {
    await withStore(SETTINGS_STORE, 'readwrite', (store) => {
      store.delete(CHAMPION_SETTING_KEY);
    });
    notifyDataChanged('champion');
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

  function loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  async function optimizeImageFile(file, options = {}) {
    const {
      maxWidth = 1280,
      maxHeight = 1280,
      mimeType = 'image/jpeg',
      quality = 0.82
    } = options;

    const rawDataUrl = await readFileAsDataURL(file);
    const image = await loadImageElement(rawDataUrl);
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#10141d';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const compressed = canvas.toDataURL(mimeType, quality);
    return compressed.length < rawDataUrl.length ? compressed : rawDataUrl;
  }

  function renderChampionPreview(data) {
    const champion = {
      ...DEFAULT_DEFENDING_CHAMPION,
      ...data,
      name: String(data?.name || DEFAULT_DEFENDING_CHAMPION.name).trim() || DEFAULT_DEFENDING_CHAMPION.name,
      title: String(data?.title || DEFAULT_DEFENDING_CHAMPION.title).trim() || DEFAULT_DEFENDING_CHAMPION.title,
      image: typeof data?.image === 'string' ? data.image : ''
    };

    const previewSrc = champion.image || createDummyImage(champion.name, champion.colorA, champion.colorB);
    championPreviewImage.src = previewSrc;
    championPreviewImage.hidden = false;
    championPreviewEmpty.hidden = true;
    championPreviewTitleText.textContent = champion.title;
    championPreviewNameText.textContent = champion.name;
  }

  async function fillChampionForm(data) {
    const champion = data || await loadChampion();
    championName.value = champion.name || '';
    championTitle.value = champion.title || '';
    championImage.value = '';
    currentChampionImageData = champion.image || '';
    renderChampionPreview(champion);
  }

  async function renderList() {
    const participants = await loadParticipants();

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
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-delete-id');
        await removeParticipant(id);
        await renderList();
      });
    });
  }

  championImage.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      const loaded = await loadChampion();
      currentChampionImageData = loaded.image || '';
      renderChampionPreview({
        name: championName.value.trim() || DEFAULT_DEFENDING_CHAMPION.name,
        title: championTitle.value.trim() || DEFAULT_DEFENDING_CHAMPION.title,
        image: currentChampionImageData,
        colorA: DEFAULT_DEFENDING_CHAMPION.colorA,
        colorB: DEFAULT_DEFENDING_CHAMPION.colorB
      });
      return;
    }

    currentChampionImageData = await optimizeImageFile(file, { maxWidth: 1400, maxHeight: 1400, quality: 0.84 });
    renderChampionPreview({
      name: championName.value.trim() || DEFAULT_DEFENDING_CHAMPION.name,
      title: championTitle.value.trim() || DEFAULT_DEFENDING_CHAMPION.title,
      image: currentChampionImageData,
      colorA: DEFAULT_DEFENDING_CHAMPION.colorA,
      colorB: DEFAULT_DEFENDING_CHAMPION.colorB
    });
  });

  championName.addEventListener('input', () => {
    renderChampionPreview({
      name: championName.value.trim() || DEFAULT_DEFENDING_CHAMPION.name,
      title: championTitle.value.trim() || DEFAULT_DEFENDING_CHAMPION.title,
      image: currentChampionImageData,
      colorA: DEFAULT_DEFENDING_CHAMPION.colorA,
      colorB: DEFAULT_DEFENDING_CHAMPION.colorB
    });
  });

  championTitle.addEventListener('input', () => {
    renderChampionPreview({
      name: championName.value.trim() || DEFAULT_DEFENDING_CHAMPION.name,
      title: championTitle.value.trim() || DEFAULT_DEFENDING_CHAMPION.title,
      image: currentChampionImageData,
      colorA: DEFAULT_DEFENDING_CHAMPION.colorA,
      colorB: DEFAULT_DEFENDING_CHAMPION.colorB
    });
  });

  championForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = championName.value.trim();
    const title = championTitle.value.trim() || DEFAULT_DEFENDING_CHAMPION.title;
    if (!name) {
      alert('王者名を入力してください。');
      return;
    }

    if (!currentChampionImageData) {
      const file = championImage.files?.[0];
      if (file) {
        currentChampionImageData = await optimizeImageFile(file, { maxWidth: 1400, maxHeight: 1400, quality: 0.84 });
      }
    }

    const saved = await saveChampion({
      id: DEFAULT_DEFENDING_CHAMPION.id,
      name,
      title,
      image: currentChampionImageData,
      colorA: DEFAULT_DEFENDING_CHAMPION.colorA,
      colorB: DEFAULT_DEFENDING_CHAMPION.colorB
    });

    if (!saved) return;
    await fillChampionForm();
    alert('ディフェンディングチャンピオン設定を保存しました。');
  });

  btnChampionResetForm.addEventListener('click', async () => {
    if (!confirm('ディフェンディングチャンピオン設定を初期値に戻します。よろしいですか？')) return;
    await clearChampion();
    await fillChampionForm({ ...DEFAULT_DEFENDING_CHAMPION });
  });

  playerImage.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      currentImageData = '';
      previewImage.hidden = true;
      previewImage.src = '';
      previewEmpty.hidden = false;
      return;
    }

    currentImageData = await optimizeImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
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
      currentImageData = await optimizeImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
    }

    const saved = await addParticipant({
      id: createId(),
      name,
      image: currentImageData,
      createdAt: Date.now()
    });

    if (!saved) return;
    await renderList();
    resetForm();
  });

  btnResetForm.addEventListener('click', resetForm);

  btnClearAll.addEventListener('click', async () => {
    if (!confirm('登録済み参加者をすべて削除します。よろしいですか？')) return;
    await clearParticipants();
    await renderList();
  });

  btnSeedDummy.addEventListener('click', async () => {
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

    const saved = await addParticipants(samples);
    if (!saved) return;
    await renderList();
  });

  window.addEventListener('storage', async (event) => {
    if (event.key === SYNC_EVENT_KEY) {
      await renderList();
      await fillChampionForm();
    }
  });

  syncChannel?.addEventListener('message', async () => {
    await renderList();
    await fillChampionForm();
  });

  async function migrateLegacyDataIfNeeded() {
    try {
      const dbParticipants = await loadParticipants();
      if (dbParticipants.length === 0) {
        const rawParticipants = localStorage.getItem(LEGACY_PARTICIPANT_KEY);
        const parsedParticipants = rawParticipants ? JSON.parse(rawParticipants) : [];
        if (Array.isArray(parsedParticipants) && parsedParticipants.length > 0) {
          await addParticipants(parsedParticipants.filter((item) => item && item.id && item.name && item.image));
        }
      }

      const currentChampion = await loadChampion();
      const rawChampion = localStorage.getItem(LEGACY_CHAMPION_KEY);
      const parsedChampion = rawChampion ? JSON.parse(rawChampion) : null;
      const isDefaultChampion = (
        currentChampion.name === DEFAULT_DEFENDING_CHAMPION.name &&
        currentChampion.title === DEFAULT_DEFENDING_CHAMPION.title &&
        !currentChampion.image
      );
      if (isDefaultChampion && parsedChampion && typeof parsedChampion === 'object') {
        await saveChampion(parsedChampion);
      }
    } catch (error) {
      console.warn('Legacy storage migration skipped', error);
    }
  }

  async function init() {
    await migrateLegacyDataIfNeeded();
    await renderList();
    resetForm();
    await fillChampionForm();
  }

  init();
});
