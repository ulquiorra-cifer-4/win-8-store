// ===== WINDOWS 8 WEB STORE — MAIN LOGIC =====

// ── STATE ──
const state = {
  installed: new Set(JSON.parse(localStorage.getItem('win8store_installed') || '[]')),
  currentCategory: 'all',
  searchQuery: '',
  currentApp: null,
  heroIndex: 0,
  heroInterval: null,
};

function saveInstalled() {
  localStorage.setItem('win8store_installed', JSON.stringify([...state.installed]));
}

// ── HELPERS ──
function stars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty) + ` ${rating}`;
}

function filtered() {
  return STORE_APPS.filter(app => {
    const catMatch = state.currentCategory === 'all' || app.category === state.currentCategory;
    const q = state.searchQuery.toLowerCase();
    const searchMatch = !q ||
      app.name.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q) ||
      app.tags.some(t => t.includes(q)) ||
      app.description.toLowerCase().includes(q);
    return catMatch && searchMatch;
  });
}

// ── TOAST ──
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── POST MESSAGE BRIDGE ──
// Notifies the parent Windows 8 Web OS when an app is installed/uninstalled
function notifyParent(type, app) {
  try {
    window.parent.postMessage({
      source: 'win8-store',
      type,          // 'app-installed' | 'app-uninstalled' | 'store-ready'
      app: {
        id: app.id,
        name: app.name,
        icon: app.icon,
        category: app.category,
        color: app.color,
        appUrl: app.appUrl,
      }
    }, '*');
  } catch (e) { /* cross-origin parent — safe to ignore */ }
}

// ── INSTALL / UNINSTALL ──
function installApp(appId, btn) {
  const app = STORE_APPS.find(a => a.id === appId);
  if (!app || state.installed.has(appId)) return;

  // Animate button
  if (btn) {
    btn.textContent = 'Installing…';
    btn.classList.add('installing');

    // Progress bar if inside modal
    const wrap = document.querySelector('.progress-bar-wrap');
    if (wrap) {
      wrap.classList.add('visible');
      wrap.innerHTML = '<div class="progress-bar"></div>';
    }
  }

  setTimeout(() => {
    state.installed.add(appId);
    saveInstalled();
    notifyParent('app-installed', app);
    renderAll();
    renderLibrary();
    showToast(`✓ ${app.name} installed successfully`);

    // Sync modal button if open
    if (state.currentApp?.id === appId) {
      const mBtn = document.getElementById('modalInstallBtn');
      if (mBtn) {
        mBtn.textContent = '✓ Installed';
        mBtn.classList.remove('installing');
        mBtn.classList.add('installed');
      }
      const wrap = document.querySelector('.progress-bar-wrap');
      if (wrap) wrap.classList.remove('visible');
    }
  }, 1600);
}

function uninstallApp(appId) {
  const app = STORE_APPS.find(a => a.id === appId);
  if (!app) return;
  state.installed.delete(appId);
  saveInstalled();
  notifyParent('app-uninstalled', app);
  renderAll();
  renderLibrary();
  showToast(`${app.name} removed`);
}

// ── RENDER APP CARD ──
function createCard(app, delay = 0) {
  const isInstalled = state.installed.has(app.id);
  const card = document.createElement('div');
  card.className = 'app-card';
  card.style.setProperty('--card-color', app.color);
  card.style.animationDelay = `${delay}ms`;

  card.innerHTML = `
    ${isInstalled ? '<span class="installed-badge">Installed</span>' : ''}
    <div class="app-card-icon" style="background:${app.color}">${app.icon}</div>
    <div class="app-card-body">
      <div class="app-card-name">${app.name}</div>
      <div class="app-card-category">${app.category}</div>
      <div class="app-card-rating">${stars(app.rating)}</div>
      <div class="app-card-footer">
        <span class="app-card-price">${app.price}</span>
        <button class="app-card-install ${isInstalled ? 'installed' : ''}" data-id="${app.id}">
          ${isInstalled ? '✓ Installed' : 'Get'}
        </button>
      </div>
      <div class="progress-bar-wrap" id="pb-card-${app.id}"></div>
    </div>
  `;

  // Open detail on card body click
  card.querySelector('.app-card-icon').addEventListener('click', () => openModal(app.id));
  card.querySelector('.app-card-name').addEventListener('click', () => openModal(app.id));

  const btn = card.querySelector('.app-card-install');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isInstalled) installApp(app.id, btn);
  });

  return card;
}

// ── RENDER LIST ITEM ──
function createListItem(app, rank) {
  const isInstalled = state.installed.has(app.id);
  const item = document.createElement('div');
  item.className = 'app-list-item';
  item.style.setProperty('--card-color', app.color);
  item.innerHTML = `
    <span class="list-rank">${rank}</span>
    <div class="list-icon" style="background:${app.color}">${app.icon}</div>
    <div class="list-info">
      <div class="list-name">${app.name}</div>
      <div class="list-cat">${app.category}</div>
      <div class="list-rating">${stars(app.rating)}</div>
    </div>
    <button class="list-install ${isInstalled ? 'installed' : ''}" data-id="${app.id}">
      ${isInstalled ? '✓ Got' : 'Get'}
    </button>
  `;

  item.addEventListener('click', () => openModal(app.id));
  const btn = item.querySelector('.list-install');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isInstalled) installApp(app.id, btn);
  });

  return item;
}

// ── RENDER ALL SECTIONS ──
function renderAll() {
  const apps = filtered();
  const isSearch = !!state.searchQuery;

  // Toggle section visibility
  document.getElementById('heroBanner').classList.toggle('hidden', isSearch);
  document.getElementById('featuredSection').classList.toggle('hidden', isSearch);
  document.getElementById('topFreeSection').classList.toggle('hidden', isSearch);

  // Featured Grid
  if (!isSearch) {
    const fg = document.getElementById('featuredGrid');
    fg.innerHTML = '';
    STORE_APPS.filter(a => a.featured &&
      (state.currentCategory === 'all' || a.category === state.currentCategory))
      .slice(0, 4)
      .forEach((app, i) => fg.appendChild(createCard(app, i * 60)));

    // Top Free List
    const tfl = document.getElementById('topFreeList');
    tfl.innerHTML = '';
    STORE_APPS.filter(a => a.topFree &&
      (state.currentCategory === 'all' || a.category === state.currentCategory))
      .slice(0, 5)
      .forEach((app, i) => tfl.appendChild(createListItem(app, i + 1)));
  }

  // All Apps Grid (or search results)
  const title = document.querySelector('#allAppsSection .section-title');
  title.textContent = isSearch
    ? `Search results for "${state.searchQuery}" (${apps.length})`
    : 'All Apps';

  const ag = document.getElementById('allAppsGrid');
  ag.innerHTML = '';
  if (apps.length === 0) {
    ag.innerHTML = `<p style="color:var(--win-text3);grid-column:1/-1;padding:32px 0;">No apps found.</p>`;
  } else {
    apps.forEach((app, i) => ag.appendChild(createCard(app, i * 40)));
  }
}

// ── LIBRARY ──
function renderLibrary() {
  const list = document.getElementById('libraryList');
  if (state.installed.size === 0) {
    list.innerHTML = '<p class="empty-library">No apps installed yet.</p>';
    return;
  }
  list.innerHTML = '';
  [...state.installed].forEach(id => {
    const app = STORE_APPS.find(a => a.id === id);
    if (!app) return;
    const item = document.createElement('div');
    item.className = 'library-item';
    item.style.setProperty('--card-color', app.color);
    item.innerHTML = `
      <div class="library-item-icon" style="background:${app.color}">${app.icon}</div>
      <div class="library-item-info">
        <div class="library-item-name">${app.name}</div>
        <div class="library-item-cat">${app.category} · v${app.version}</div>
      </div>
      <button class="uninstall-btn" data-id="${app.id}">Remove</button>
    `;
    item.querySelector('.uninstall-btn').addEventListener('click', () => uninstallApp(app.id));
    list.appendChild(item);
  });
}

// ── MODAL ──
function openModal(appId) {
  const app = STORE_APPS.find(a => a.id === appId);
  if (!app) return;
  state.currentApp = app;

  const isInstalled = state.installed.has(appId);

  document.getElementById('modalIcon').textContent = app.icon;
  document.getElementById('modalIcon').style.background = app.color;
  document.getElementById('modalTitle').textContent = app.name;
  document.getElementById('modalPublisher').textContent = `By ${app.publisher}`;
  document.getElementById('modalDesc').textContent = app.description;
  document.getElementById('modalCat').textContent = app.category;
  document.getElementById('modalPrice').textContent = app.price;
  document.getElementById('modalRating').textContent = `⭐ ${app.rating} (${app.reviews.toLocaleString()} reviews)`;
  document.getElementById('modalSize').textContent = `📦 ${app.size}`;
  document.getElementById('modalVersion').textContent = `🔖 v${app.version}`;

  // Screenshots
  const ss = document.getElementById('modalScreenshots');
  ss.innerHTML = '';
  app.screenshots.forEach(s => {
    const thumb = document.createElement('div');
    thumb.className = 'screenshot-thumb';
    thumb.textContent = s;
    ss.appendChild(thumb);
  });

  // Tags
  const tags = document.getElementById('modalTags');
  tags.innerHTML = app.tags.map(t => `<span class="tag">${t}</span>`).join('');

  // Install button
  const mBtn = document.getElementById('modalInstallBtn');
  mBtn.textContent = isInstalled ? '✓ Installed' : 'Install';
  mBtn.className = 'install-btn' + (isInstalled ? ' installed' : '');
  mBtn.onclick = () => {
    if (!state.installed.has(appId)) installApp(appId, mBtn);
  };

  // Progress bar
  const existingPb = document.querySelector('.app-modal .progress-bar-wrap');
  if (!existingPb) {
    const pb = document.createElement('div');
    pb.className = 'progress-bar-wrap';
    document.querySelector('.modal-actions').appendChild(pb);
  } else {
    existingPb.classList.remove('visible');
    existingPb.innerHTML = '';
  }

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  state.currentApp = null;
}

// ── HERO BANNER ──
function updateHero(index) {
  const slide = HERO_SLIDES[index % HERO_SLIDES.length];
  const app = STORE_APPS.find(a => a.id === slide.id) || STORE_APPS[0];

  document.getElementById('heroTitle').textContent = slide.title;
  document.getElementById('heroDesc').textContent = slide.desc;
  document.getElementById('heroIcon').textContent = app.icon;

  const heroBtn = document.getElementById('heroInstallBtn');
  const isInstalled = state.installed.has(app.id);
  heroBtn.textContent = isInstalled ? '✓ Installed' : 'Get';
  heroBtn.onclick = () => {
    if (!isInstalled) installApp(app.id, heroBtn);
  };

  // Dot indicators
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i === index % HERO_SLIDES.length);
  });

  // Gradient shift
  const gradients = [
    'linear-gradient(135deg, #0078d4 0%, #00adef 50%, #006dbe 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #6d28d9 100%)',
    'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #15803d 100%)',
  ];
  document.querySelector('.hero-banner').style.background = gradients[index % gradients.length];
}

function startHeroRotation() {
  updateHero(0);
  state.heroInterval = setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % HERO_SLIDES.length;
    updateHero(state.heroIndex);
  }, 5000);
}

// ── CATEGORY FILTER ──
function setCategory(cat) {
  state.currentCategory = cat;
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.cat-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === cat));
  renderAll();
}

// ── SEARCH ──
let searchDebounce;
function onSearch(q) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchQuery = q.trim();
    renderAll();
  }, 220);
}

// ── EVENTS ──
function bindEvents() {
  // Category buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.cat));
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', e => onSearch(e.target.value));

  // Library panel
  document.getElementById('installedBtn').addEventListener('click', () => {
    renderLibrary();
    document.getElementById('libraryPanel').classList.add('open');
  });
  document.getElementById('closeLibrary').addEventListener('click', () => {
    document.getElementById('libraryPanel').classList.remove('open');
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Hero dots
  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      state.heroIndex = parseInt(dot.dataset.i);
      clearInterval(state.heroInterval);
      updateHero(state.heroIndex);
      state.heroInterval = setInterval(() => {
        state.heroIndex = (state.heroIndex + 1) % HERO_SLIDES.length;
        updateHero(state.heroIndex);
      }, 5000);
    });
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('libraryPanel').classList.remove('open');
    }
  });

  // Listen for messages from parent OS
  window.addEventListener('message', (e) => {
    const { type, appId } = e.data || {};
    if (type === 'store-query-installed') {
      // Parent OS asking what's installed (on load sync)
      e.source?.postMessage({
        source: 'win8-store',
        type: 'installed-list',
        apps: [...state.installed].map(id => {
          const app = STORE_APPS.find(a => a.id === id);
          return app ? { id: app.id, name: app.name, icon: app.icon,
            category: app.category, color: app.color, appUrl: app.appUrl } : null;
        }).filter(Boolean)
      }, '*');
    }
    if (type === 'store-focus-app' && appId) {
      openModal(appId);
    }
  });
}

// ── INIT ──
function init() {
  bindEvents();
  startHeroRotation();
  renderAll();

  // Notify parent OS that store is ready
  setTimeout(() => {
    window.parent.postMessage({ source: 'win8-store', type: 'store-ready' }, '*');
  }, 300);
}

document.addEventListener('DOMContentLoaded', init);
