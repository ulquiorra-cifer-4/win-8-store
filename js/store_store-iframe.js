// ===== WINDOWS 8 WEB STORE — MAIN LOGIC (v2 — Real Install Edition) =====

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

function stars(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty) + ` ${rating}`;
}

function filtered() {
  return STORE_APPS.filter(app => {
    const catMatch    = state.currentCategory === 'all' || app.category === state.currentCategory;
    const q           = state.searchQuery.toLowerCase();
    const searchMatch = !q ||
      app.name.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q) ||
      app.tags.some(t => t.includes(q)) ||
      app.description.toLowerCase().includes(q);
    return catMatch && searchMatch;
  });
}

function showToast(msg, duration) {
  duration = duration || 2800;
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, duration);
}

// ── POST MESSAGE BRIDGE ──
function notifyParent(type, app) {
  try {
    var payload = {
      source : 'win8-store',
      type   : type,
      app: {
        id      : app.id,
        name    : app.name,
        icon    : app.icon,
        category: app.category,
        color   : app.color,
        appType : app.appType  || 'builtin',
        appUrl  : app.appUrl   || null,
        openFn  : app.openFn   || null,
      }
    };
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
    window.dispatchEvent(new CustomEvent('win8-store-event', { detail: payload }));
  } catch(e) {}
}

// ── INSTALL ENGINE ──
function installApp(appId, triggerBtn) {
  var app = STORE_APPS.find(function(a) { return a.id === appId; });
  if (!app || state.installed.has(appId)) return;

  if (triggerBtn) {
    triggerBtn.textContent = 'Installing\u2026';
    triggerBtn.classList.add('installing');
    triggerBtn.disabled = true;
  }

  var modalPbWrap = document.getElementById('modalProgressWrap');
  var modalPb     = document.getElementById('modalProgressBar');
  if (modalPbWrap && modalPb) {
    modalPbWrap.style.display = 'block';
    modalPb.style.transition  = '';
    modalPb.style.width       = '0%';
    setTimeout(function() { modalPb.style.transition = 'width 0.6s ease'; modalPb.style.width = '45%'; }, 50);
    setTimeout(function() { modalPb.style.transition = 'width 0.8s ease'; modalPb.style.width = '80%'; }, 700);
  }

  setTimeout(function() {
    state.installed.add(appId);
    saveInstalled();

    if (modalPbWrap && modalPb) {
      modalPb.style.transition = 'width 0.3s ease';
      modalPb.style.width = '100%';
      setTimeout(function() {
        modalPbWrap.style.display = 'none';
        modalPb.style.width = '0%';
        modalPb.style.transition = '';
      }, 600);
    }

    notifyParent('app-installed', app);
    renderAll();
    renderLibrary();

    if (state.currentApp && state.currentApp.id === appId) {
      var mBtn = document.getElementById('modalInstallBtn');
      if (mBtn) {
        mBtn.textContent = '\u2713 Installed';
        mBtn.classList.remove('installing');
        mBtn.classList.add('installed');
        mBtn.disabled = true;
      }
    }

    showToast('\u2713 ' + app.name + ' installed successfully');
  }, 1700);
}

function uninstallApp(appId) {
  var app = STORE_APPS.find(function(a) { return a.id === appId; });
  if (!app) return;
  state.installed.delete(appId);
  saveInstalled();
  notifyParent('app-uninstalled', app);
  renderAll();
  renderLibrary();
  showToast(app.name + ' removed');
}

// ── CARD ──
function createCard(app, delay) {
  delay = delay || 0;
  var isInstalled = state.installed.has(app.id);
  var card = document.createElement('div');
  card.className = 'app-card';
  card.style.setProperty('--card-color', app.color);
  card.style.animationDelay = delay + 'ms';

  card.innerHTML =
    (isInstalled ? '<span class="installed-badge">Installed</span>' : '') +
    '<div class="app-card-icon" style="background:' + app.color + '">' + app.icon + '</div>' +
    '<div class="app-card-body">' +
      '<div class="app-card-name">' + app.name + '</div>' +
      '<div class="app-card-category">' + app.category + '</div>' +
      '<div class="app-card-rating">' + stars(app.rating) + '</div>' +
      '<div class="app-card-footer">' +
        '<span class="app-card-price">' + app.price + '</span>' +
        '<button class="app-card-install' + (isInstalled ? ' installed' : '') + '" data-id="' + app.id + '"' + (isInstalled ? ' disabled' : '') + '>' +
          (isInstalled ? '\u2713 Installed' : 'Get') +
        '</button>' +
      '</div>' +
    '</div>';

  card.querySelector('.app-card-icon').addEventListener('click', function() { openModal(app.id); });
  card.querySelector('.app-card-name').addEventListener('click', function() { openModal(app.id); });

  var btn = card.querySelector('.app-card-install');
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!state.installed.has(app.id)) installApp(app.id, btn);
  });
  return card;
}

// ── LIST ITEM ──
function createListItem(app, rank) {
  var isInstalled = state.installed.has(app.id);
  var item = document.createElement('div');
  item.className = 'app-list-item';
  item.style.setProperty('--card-color', app.color);
  item.innerHTML =
    '<span class="list-rank">' + rank + '</span>' +
    '<div class="list-icon" style="background:' + app.color + '">' + app.icon + '</div>' +
    '<div class="list-info">' +
      '<div class="list-name">' + app.name + '</div>' +
      '<div class="list-cat">' + app.category + '</div>' +
      '<div class="list-rating">' + stars(app.rating) + '</div>' +
    '</div>' +
    '<button class="list-install' + (isInstalled ? ' installed' : '') + '" data-id="' + app.id + '"' + (isInstalled ? ' disabled' : '') + '>' +
      (isInstalled ? '\u2713 Got' : 'Get') +
    '</button>';

  item.addEventListener('click', function() { openModal(app.id); });
  var btn = item.querySelector('.list-install');
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!state.installed.has(app.id)) installApp(app.id, btn);
  });
  return item;
}

// ── RENDER ALL ──
function renderAll() {
  var apps     = filtered();
  var isSearch = !!state.searchQuery;

  document.getElementById('heroBanner').classList.toggle('hidden', isSearch);
  document.getElementById('featuredSection').classList.toggle('hidden', isSearch);
  document.getElementById('topFreeSection').classList.toggle('hidden', isSearch);

  if (!isSearch) {
    var fg = document.getElementById('featuredGrid');
    fg.innerHTML = '';
    STORE_APPS.filter(function(a) {
      return a.featured && (state.currentCategory === 'all' || a.category === state.currentCategory);
    }).slice(0, 4).forEach(function(app, i) { fg.appendChild(createCard(app, i * 60)); });

    var tfl = document.getElementById('topFreeList');
    tfl.innerHTML = '';
    STORE_APPS.filter(function(a) {
      return a.topFree && (state.currentCategory === 'all' || a.category === state.currentCategory);
    }).slice(0, 5).forEach(function(app, i) { tfl.appendChild(createListItem(app, i + 1)); });
  }

  var title = document.querySelector('#allAppsSection .section-title');
  title.textContent = isSearch
    ? 'Search results for "' + state.searchQuery + '" (' + apps.length + ')'
    : 'All Apps';

  var ag = document.getElementById('allAppsGrid');
  ag.innerHTML = '';
  if (apps.length === 0) {
    ag.innerHTML = '<p style="color:var(--win-text3);grid-column:1/-1;padding:32px 0;">No apps found.</p>';
  } else {
    apps.forEach(function(app, i) { ag.appendChild(createCard(app, i * 40)); });
  }
}

// ── LIBRARY ──
function renderLibrary() {
  var list = document.getElementById('libraryList');
  if (state.installed.size === 0) {
    list.innerHTML = '<p class="empty-library">No apps installed yet.</p>';
    return;
  }
  list.innerHTML = '';
  Array.from(state.installed).forEach(function(id) {
    var app = STORE_APPS.find(function(a) { return a.id === id; });
    if (!app) return;
    var item = document.createElement('div');
    item.className = 'library-item';
    item.style.setProperty('--card-color', app.color);
    item.innerHTML =
      '<div class="library-item-icon" style="background:' + app.color + '">' + app.icon + '</div>' +
      '<div class="library-item-info">' +
        '<div class="library-item-name">' + app.name + '</div>' +
        '<div class="library-item-cat">' + app.category + ' \u00b7 v' + app.version + '</div>' +
      '</div>' +
      '<button class="uninstall-btn" data-id="' + app.id + '">Remove</button>';
    item.querySelector('.uninstall-btn').addEventListener('click', function() { uninstallApp(app.id); });
    list.appendChild(item);
  });
}

// ── MODAL ──
function openModal(appId) {
  var app = STORE_APPS.find(function(a) { return a.id === appId; });
  if (!app) return;
  state.currentApp = app;

  var isInstalled = state.installed.has(appId);

  document.getElementById('modalIcon').textContent      = app.icon;
  document.getElementById('modalIcon').style.background = app.color;
  document.getElementById('modalTitle').textContent     = app.name;
  document.getElementById('modalPublisher').textContent = 'By ' + app.publisher;
  document.getElementById('modalDesc').textContent      = app.description;
  document.getElementById('modalCat').textContent       = app.category;
  document.getElementById('modalPrice').textContent     = app.price;
  document.getElementById('modalRating').textContent    = '\u2b50 ' + app.rating + ' (' + app.reviews.toLocaleString() + ' reviews)';
  document.getElementById('modalSize').textContent      = '\ud83d\udce6 ' + app.size;
  document.getElementById('modalVersion').textContent   = '\ud83d\udd16 v' + app.version;

  var ss = document.getElementById('modalScreenshots');
  ss.innerHTML = '';
  app.screenshots.forEach(function(s) {
    var thumb = document.createElement('div');
    thumb.className   = 'screenshot-thumb';
    thumb.textContent = s;
    ss.appendChild(thumb);
  });

  document.getElementById('modalTags').innerHTML =
    app.tags.map(function(t) { return '<span class="tag">' + t + '</span>'; }).join('');

  var mBtn = document.getElementById('modalInstallBtn');
  mBtn.textContent = isInstalled ? '\u2713 Installed' : 'Install';
  mBtn.className   = 'install-btn' + (isInstalled ? ' installed' : '');
  mBtn.disabled    = isInstalled;
  mBtn.onclick     = function() {
    if (!state.installed.has(appId)) installApp(appId, mBtn);
  };

  var pbWrap = document.getElementById('modalProgressWrap');
  var pb     = document.getElementById('modalProgressBar');
  if (pbWrap) pbWrap.style.display = 'none';
  if (pb)     { pb.style.width = '0%'; pb.style.transition = ''; }

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
  var slide = HERO_SLIDES[index % HERO_SLIDES.length];
  var app   = STORE_APPS.find(function(a) { return a.id === slide.id; }) || STORE_APPS[0];

  document.getElementById('heroTitle').textContent = slide.title;
  document.getElementById('heroDesc').textContent  = slide.desc;
  document.getElementById('heroIcon').textContent  = app.icon;

  var heroBtn    = document.getElementById('heroInstallBtn');
  var isInstalled = state.installed.has(app.id);
  heroBtn.textContent = isInstalled ? '\u2713 Installed' : 'Get';
  heroBtn.disabled    = isInstalled;
  heroBtn.onclick     = function() {
    if (!isInstalled) installApp(app.id, heroBtn);
  };

  var gradients = [
    'linear-gradient(135deg, #0078d4 0%, #00adef 50%, #006dbe 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #6d28d9 100%)',
    'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #15803d 100%)',
  ];
  document.querySelector('.hero-banner').style.background = gradients[index % gradients.length];
  document.querySelectorAll('.dot').forEach(function(d, i) {
    d.classList.toggle('active', i === index % HERO_SLIDES.length);
  });
}

function startHeroRotation() {
  updateHero(0);
  state.heroInterval = setInterval(function() {
    state.heroIndex = (state.heroIndex + 1) % HERO_SLIDES.length;
    updateHero(state.heroIndex);
  }, 5000);
}

// ── CATEGORY ──
function setCategory(cat) {
  state.currentCategory = cat;
  state.searchQuery     = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.cat-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  renderAll();
}

// ── SEARCH ──
var searchDebounce;
function onSearch(q) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(function() {
    state.searchQuery = q.trim();
    renderAll();
  }, 220);
}

// ── LISTEN FOR MESSAGES FROM PARENT OS ──
window.addEventListener('message', function(e) {
  var data = e.data || {};
  if (!data.type) return;
  if (data.type === 'store-query-installed') {
    try {
      var list = Array.from(state.installed).map(function(id) {
        var app = STORE_APPS.find(function(a) { return a.id === id; });
        return app ? { id:app.id, name:app.name, icon:app.icon,
          category:app.category, color:app.color,
          appType:app.appType, appUrl:app.appUrl, openFn:app.openFn } : null;
      }).filter(Boolean);
      e.source.postMessage({ source:'win8-store', type:'installed-list', apps:list }, '*');
    } catch(_) {}
  }
  if (data.type === 'store-focus-app' && data.appId) {
    openModal(data.appId);
  }
  if (data.type === 'store-uninstall-app' && data.appId) {
    uninstallApp(data.appId);
  }
});

// ── BIND EVENTS ──
function bindEvents() {
  document.querySelectorAll('.cat-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { setCategory(btn.dataset.cat); });
  });

  document.getElementById('searchInput').addEventListener('input', function(e) { onSearch(e.target.value); });

  document.getElementById('installedBtn').addEventListener('click', function() {
    renderLibrary();
    document.getElementById('libraryPanel').classList.add('open');
  });
  document.getElementById('closeLibrary').addEventListener('click', function() {
    document.getElementById('libraryPanel').classList.remove('open');
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  document.querySelectorAll('.dot').forEach(function(dot) {
    dot.addEventListener('click', function() {
      state.heroIndex = parseInt(dot.dataset.i);
      clearInterval(state.heroInterval);
      updateHero(state.heroIndex);
      state.heroInterval = setInterval(function() {
        state.heroIndex = (state.heroIndex + 1) % HERO_SLIDES.length;
        updateHero(state.heroIndex);
      }, 5000);
    });
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('libraryPanel').classList.remove('open');
    }
  });
}

// ── INIT ──
function init() {
  bindEvents();
  startHeroRotation();
  renderAll();
  setTimeout(function() {
    notifyParent('store-ready', { id:'store', name:'Store', icon:'\ud83d\uded2',
      category:'system', color:'', appType:'builtin', appUrl:null, openFn:null });
  }, 300);
}

document.addEventListener('DOMContentLoaded', init);
