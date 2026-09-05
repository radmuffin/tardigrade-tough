import { FlyClient } from '/_fly/fly-device-sync.js';
import { FlyToast, FlyTheme } from '/_fly/fly-ui.js';
import { PixelDiorama } from '/canvas-art.js';
import { OfflineSyncManager } from '/offline-sync.js';

// State
let roomSlug = getRoomFromUrl() || 'main';
const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? `${window.location.origin}/api`
  : '/api';
let client = new FlyClient({ baseUrl: apiBase });
let diorama = null;
let trophyDiorama = null;
let offlineSync = null;
let currentRoomData = null;
let selectedGoalIndex = 0;
let pendingGoalTheme = null;
let ws = null;
let lastLoggedSet = null;
let activityFilter = 'all';
let leaderboardCategory = 'all';

function getRoomFromUrl() {
  const match = window.location.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') || 'main';
}

function formatNumber(num) {
  return Math.round(num).toLocaleString('en-US');
}

// 1. Initialize App
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('dioramaCanvas');
  diorama = new PixelDiorama(canvas);

  const trophyCanvas = document.getElementById('trophyCanvas');
  if (trophyCanvas) {
    trophyDiorama = new PixelDiorama(trophyCanvas);
    trophyDiorama.setTheme('whale', 1.0);
  }

  offlineSync = new OfflineSyncManager(client, updateOfflineStatus);

  setupViewNavigation();
  setupGoalSegmentedControl();
  setupLeaderboardTabs();
  setupLoggingTabs();
  setupSteppers();
  setupFastAdd();
  setupWorkoutMode();
  setupCheers();
  setupModals();
  setupSheetImporter();
  setupActivityFilters();
  setupPwa();

  await loadRoomState();
  initWebSocket();
});

// Primary View Navigation with Touch Swipe Gestures
const VIEW_ORDER = ['quests', 'leaderboard', 'activity', 'trophy'];
let currentView = 'quests';

function setupViewNavigation() {
  const navBtns = {
    quests: document.getElementById('navQuestsBtn'),
    leaderboard: document.getElementById('navLeaderboardBtn'),
    activity: document.getElementById('navActivityBtn'),
    trophy: document.getElementById('navTrophyBtn'),
  };

  const views = {
    quests: document.getElementById('viewQuests'),
    leaderboard: document.getElementById('viewLeaderboard'),
    activity: document.getElementById('viewActivity'),
    trophy: document.getElementById('viewTrophy'),
  };

  function switchView(target) {
    if (!views[target]) return;
    currentView = target;

    Object.keys(navBtns).forEach(k => {
      if (navBtns[k]) {
        const isActive = k === target;
        navBtns[k].classList.toggle('active', isActive);
        navBtns[k].setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (views[k]) {
        views[k].style.display = k === target ? 'block' : 'none';
      }
    });

    if (target === 'trophy' && trophyDiorama) {
      setTimeout(() => {
        trophyDiorama.resize();
        renderTrophyRoom();
      }, 50);
    } else if (target === 'quests' && diorama) {
      setTimeout(() => {
        diorama.resize();
        renderGoalShowcase();
      }, 50);
    }
  }

  window.switchView = switchView;

  Object.keys(navBtns).forEach(k => {
    if (navBtns[k]) {
      navBtns[k].addEventListener('click', () => switchView(k));
    }
  });

  // Connective navigation across screens with robust delegation
  document.addEventListener('click', (e) => {
    const connBtn = e.target.closest('.connective-btn, .connective-pill-card, [data-target]');
    if (connBtn && connBtn.dataset && connBtn.dataset.target) {
      const target = connBtn.dataset.target;
      if (views[target]) {
        e.preventDefault();
        switchView(target);
        if (connBtn.dataset.scrollto) {
          setTimeout(() => {
            const el = document.getElementById(connBtn.dataset.scrollto);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('highlight-pulse');
              setTimeout(() => el.classList.remove('highlight-pulse'), 1600);
            }
          }, 80);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
  });

  // Touch Swipe Navigation between 4 main views
  setupSwipeNavigation(switchView);
}

function setupSwipeNavigation(switchView) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  window.addEventListener('touchstart', (e) => {
    // Ignore interactive elements, diorama canvas, modals, form fields, buttons
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('canvas, input, select, textarea, button, .modal-backdrop, .modal-box, .color-option, .stepper-btn')) {
      touchStartX = 0;
      touchStartY = 0;
      return;
    }
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!touchStartX || !touchStartY) return;
    if (!e.changedTouches || e.changedTouches.length !== 1) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    touchStartX = 0;
    touchStartY = 0;

    // Fast horizontal swipe (< 500ms, > 45px distance, primarily horizontal)
    if (deltaTime < 500 && Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      const curIdx = VIEW_ORDER.indexOf(currentView);
      if (curIdx === -1) return;

      if (deltaX < 0) {
        // Swiped LEFT -> Next view (e.g. Quests -> Leaderboard)
        if (curIdx < VIEW_ORDER.length - 1) {
          switchView(VIEW_ORDER[curIdx + 1]);
        }
      } else {
        // Swiped RIGHT -> Previous view (e.g. Leaderboard -> Quests)
        if (curIdx > 0) {
          switchView(VIEW_ORDER[curIdx - 1]);
        }
      }
    }
  }, { passive: true });
}

// Canonical goal order matching visual tab layout: [Pando, Everest, Caribou]
const CANONICAL_THEME_ORDER = ['pando', 'everest', 'caribou'];

function cycleGoal(direction) {
  if (!currentRoomData || !currentRoomData.active_goals || currentRoomData.active_goals.length === 0) return;
  const currentGoal = currentRoomData.active_goals[selectedGoalIndex] || currentRoomData.active_goals[0];
  const curTheme = currentGoal.theme_key;

  // Active themes in exact visual tab order
  const activeThemes = CANONICAL_THEME_ORDER.filter(t => 
    currentRoomData.active_goals.some(g => g.theme_key === t)
  );
  currentRoomData.active_goals.forEach(g => {
    if (!activeThemes.includes(g.theme_key)) activeThemes.push(g.theme_key);
  });

  if (activeThemes.length <= 1) return;

  let curIdx = activeThemes.indexOf(curTheme);
  if (curIdx === -1) curIdx = 0;

  let nextIdx;
  if (direction > 0) {
    // Right arrow (›) or swipe left: advance to next tab on the right
    nextIdx = (curIdx + 1) % activeThemes.length;
  } else {
    // Left arrow (‹) or swipe right: move to previous tab on the left
    nextIdx = (curIdx - 1 + activeThemes.length) % activeThemes.length;
  }

  const targetTheme = activeThemes[nextIdx];
  const targetGoalIndex = currentRoomData.active_goals.findIndex(g => g.theme_key === targetTheme);
  if (targetGoalIndex !== -1) {
    selectedGoalIndex = targetGoalIndex;
    renderGoalShowcase();
  }
}

// Goal Segmented Control & Arrow / Diorama Swipe Cycling
function setupGoalSegmentedControl() {
  const pandoBtn = document.getElementById('goalTabPando');
  const everestBtn = document.getElementById('goalTabEverest');
  const caribouBtn = document.getElementById('goalTabCaribou');
  const prevBtn = document.getElementById('prevGoalBtn');
  const nextBtn = document.getElementById('nextGoalBtn');

  function selectGoalByTheme(theme) {
    pendingGoalTheme = theme;
    if (!currentRoomData || !currentRoomData.active_goals) return;
    const idx = currentRoomData.active_goals.findIndex(g => g.theme_key === theme);
    if (idx !== -1) {
      selectedGoalIndex = idx;
      renderGoalShowcase();
    }
  }

  if (pandoBtn) pandoBtn.addEventListener('click', () => selectGoalByTheme('pando'));
  if (everestBtn) everestBtn.addEventListener('click', () => selectGoalByTheme('everest'));
  if (caribouBtn) caribouBtn.addEventListener('click', () => selectGoalByTheme('caribou'));

  // Left arrow (‹): previous goal to the left
  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleGoal(-1);
    });
  }

  // Right arrow (›): next goal to the right
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleGoal(1);
    });
  }

  // Touch Swipe Gestures directly on Diorama Canvas
  const canvasWrapper = document.querySelector('.canvas-wrapper');
  if (canvasWrapper) {
    let canvasStartX = 0;
    let canvasStartY = 0;

    canvasWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        canvasStartX = e.touches[0].clientX;
        canvasStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    canvasWrapper.addEventListener('touchend', (e) => {
      if (!canvasStartX) return;
      const deltaX = e.changedTouches[0].clientX - canvasStartX;
      const deltaY = e.changedTouches[0].clientY - canvasStartY;
      canvasStartX = 0;

      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          cycleGoal(1); // swipe left -> next goal to the right
        } else {
          cycleGoal(-1); // swipe right -> previous goal to the left
        }
      }
    }, { passive: true });
  }
}

// Leaderboard Category Filter Tabs (Safe fallback)
function setupLeaderboardTabs() {
  // Leaderboard displays all categories vertically
}

// Activity Filter Tabs
function setupActivityFilters() {
  const allBtn = document.getElementById('filterAllCrewBtn');
  const myBtn = document.getElementById('filterMyLiftsBtn');

  allBtn.addEventListener('click', () => {
    activityFilter = 'all';
    allBtn.classList.add('active');
    myBtn.classList.remove('active');
    renderFeed();
  });

  myBtn.addEventListener('click', () => {
    activityFilter = 'my';
    myBtn.classList.add('active');
    allBtn.classList.remove('active');
    renderFeed();
  });
}

// 2. Offline Status UI
function updateOfflineStatus(status) {
  const dot = document.getElementById('footerStatusDot');
  const text = document.getElementById('footerStatusText');

  if (status.pendingCount > 0) {
    dot.style.color = 'var(--accent-amber)';
    text.textContent = `Syncing (${status.pendingCount} queued) ⏳`;
  } else if (!status.isOnline) {
    dot.style.color = 'var(--accent-amber)';
    text.textContent = 'Offline (Queued) 🔌';
  } else {
    dot.style.color = 'var(--accent-green)';
    text.textContent = 'Live & Syncing ⚡';
  }
}

// 3. Load Room State from Backend
async function loadRoomState() {
  try {
    const res = await client.get(`/room/${roomSlug}`);
    if (res && res.success) {
      currentRoomData = res.data;

      // Ensure active_goals are in the exact order as the visual tabs: Pando -> Everest -> Caribou
      if (currentRoomData && currentRoomData.active_goals) {
        const themeOrder = ['pando', 'everest', 'caribou'];
        currentRoomData.active_goals.sort((a, b) => {
          const ia = themeOrder.indexOf(a.theme_key);
          const ib = themeOrder.indexOf(b.theme_key);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
      }

      renderAll();
    }
  } catch (err) {
    console.warn('Failed to load room data (possibly offline):', err);
    FlyToast.info('Working offline: your logs will sync when reconnected.');
  } finally {
    document.body.dataset.state = 'ready';
  }
}

function renderAll() {
  if (!currentRoomData) return;

  // Render Header Profile & Group Chip
  const pNick = document.getElementById('profileNick');
  if (pNick) pNick.textContent = currentRoomData.user_profile.nickname;
  const pDot = document.getElementById('profileDot');
  if (pDot) pDot.style.backgroundColor = currentRoomData.user_profile.avatar_color;
  const rLabel = document.getElementById('roomNameLabel');
  if (rLabel) rLabel.textContent = currentRoomData.room.name;
  const pBtn = document.getElementById('profileBtn');
  if (pBtn) pBtn.title = `${currentRoomData.user_profile.nickname} · ${currentRoomData.room.name} (Settings)`;

  // Render Active Goal Showcase
  renderGoalShowcase();

  // Render Leaderboard
  renderLeaderboard();

  // Render Live Feed
  renderFeed();

  // Render Trophy Room
  renderTrophyRoom();

  // Render Squad Wishlist Proposals
  renderWishlists();
}

function renderGoalShowcase() {
  const activeGoals = currentRoomData.active_goals || [];
  if (activeGoals.length === 0) return;

  if (pendingGoalTheme) {
    const pIdx = activeGoals.findIndex(g => g.theme_key === pendingGoalTheme);
    if (pIdx !== -1) {
      selectedGoalIndex = pIdx;
    }
    pendingGoalTheme = null;
  }

  if (selectedGoalIndex >= activeGoals.length) selectedGoalIndex = 0;
  const currentGoal = activeGoals[selectedGoalIndex];

  // Highlight active segment button & sync ARIA tabs
  const segControl = document.getElementById('goalSegmentedControl');
  if (segControl) {
    activeGoals.forEach((g, idx) => {
      let btnId = '';
      if (g.theme_key === 'pando') btnId = 'goalTabPando';
      else if (g.theme_key === 'everest') btnId = 'goalTabEverest';
      else if (g.theme_key === 'caribou') btnId = 'goalTabCaribou';
      else btnId = `goalTab_${g.id}`;

      let btn = document.getElementById(btnId);
      if (!btn) {
        btn = document.createElement('button');
        btn.id = btnId;
        btn.className = 'goal-segment-btn';
        btn.setAttribute('role', 'tab');
        btn.dataset.theme = g.theme_key;
        const emoji = g.theme_key === 'whale' ? '🐋' : (g.category === 'weight' ? '🌲' : g.category === 'distance' ? '🦌' : g.category === 'elevation' ? '🐐' : '🎯');
        const shortName = g.title.split(' ')[0];
        btn.innerHTML = `<span class="segment-emoji">${emoji}</span> <span class="segment-title">${FlyToast.escape(shortName)}</span>`;
        btn.addEventListener('click', () => {
          selectedGoalIndex = idx;
          renderGoalShowcase();
        });
        segControl.appendChild(btn);
      }
      const isActive = idx === selectedGoalIndex;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  // Update Hero Stats
  const pct = currentGoal.target_value > 0 ? (currentGoal.current_value / currentGoal.target_value) : 0;
  const pctStr = (Math.min(100, pct * 100)).toFixed(1) + '%';

  document.getElementById('heroGoalTitle').textContent = currentGoal.title;
  document.getElementById('heroGoalPct').textContent = pctStr;
  document.getElementById('heroGoalCurrent').textContent = `${formatNumber(currentGoal.current_value)} ${currentGoal.unit}`;
  document.getElementById('heroGoalTarget').textContent = `Target: ${formatNumber(currentGoal.target_value)} ${currentGoal.unit}`;
  document.getElementById('heroGoalDesc').textContent = currentGoal.description;

  // Update Diorama
  if (diorama) {
    diorama.setTheme(currentGoal.theme_key, pct);
  }

  // Auto-route category in Fast-Add
  const fastAddCat = document.getElementById('fastAddCategory');
  if (fastAddCat && fastAddCat.value !== currentGoal.category) {
    fastAddCat.value = currentGoal.category;
    fastAddCat.dispatchEvent(new Event('change'));
  }

  // Auto-route Stepper interface for active goal metric
  updateStepperForGoal(currentGoal);
}

function renderTrophyRoom() {
  if (!currentRoomData) return;
  const completed = currentRoomData.completed_goals || [];
  const trophyContainer = document.getElementById('viewTrophy');
  if (!trophyContainer) return;

  if (completed.length > 0) {
    const trophy = completed[0];
    const titleEl = trophyContainer.querySelector('.goal-hero-title');
    const descEl = trophyContainer.querySelector('.goal-hero-desc');
    const subEl = trophyContainer.querySelector('.goal-progress-sub');

    if (titleEl) {
      titleEl.textContent = `${trophy.theme_key === 'whale' ? '🐋 ' : '🏆 '}${trophy.title}`;
    }
    if (descEl) {
      descEl.textContent = trophy.description;
    }
    if (subEl) {
      subEl.innerHTML = `
        <span>${formatNumber(trophy.current_value)} ${trophy.unit} Lifted</span>
        <span>Target: ${formatNumber(trophy.target_value)} ${trophy.unit}</span>
      `;
    }
    if (trophyDiorama) {
      trophyDiorama.setTheme(trophy.theme_key, 1.0);
    }
  }
}

function renderWishlists() {
  const container = document.getElementById('wishlistCardsContainer');
  if (!container || !currentRoomData) return;
  const list = currentRoomData.wishlists || [];

  const countLabel = document.getElementById('questsWishlistCountLabel');
  if (countLabel) {
    countLabel.textContent = `Squad Wishlist (${list.length})`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="wishlist-empty-box">
        No quest proposals yet! Tap <strong>+ Propose Goal</strong> to suggest the crew's next colossal benchmark.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const cat = item.category || 'weight';
    const catEmoji = cat === 'weight' ? '🏋️' : cat === 'distance' ? '🏃' : (cat === 'elevation' ? '🧗' : '🎯');
    const safeTitle = FlyToast.escape(item.title);
    const safeNotes = item.notes ? FlyToast.escape(item.notes) : '';
    const safeUnit = FlyToast.escape(item.unit);

    const ghTitle = encodeURIComponent(`[Quest Proposal] ${item.title} (${cat})`);
    const ghBody = encodeURIComponent(
      `### 🌲 New Quest Proposal from Tardigrade Tough\n\n` +
      `- **Quest Title**: ${item.title}\n` +
      `- **Category**: \`${cat}\` (${item.unit})\n` +
      `- **Target Metric**: ${formatNumber(item.target_value)} ${item.unit}\n` +
      `- **Squad Room**: \`${item.room_slug || roomSlug}\`\n\n` +
      `#### 📝 Notes & Lore\n` +
      `> ${item.notes || 'No extra notes provided.'}\n\n` +
      `---\n` +
      `*Submitted via Tardigrade Tough app.*`
    );
    const ghIssueUrl = `https://github.com/radmuffin/tardigrade-tough/issues/new?title=${ghTitle}&body=${ghBody}&labels=quest-proposal`;

    return `
      <div class="wishlist-card">
        <div class="wishlist-header-row">
          <span class="wishlist-card-title">${safeTitle}</span>
          <span class="wishlist-cat-badge ${FlyToast.escape(cat)}">${catEmoji} ${FlyToast.escape(cat)}</span>
        </div>
        <div class="wishlist-meta-row">
          <span>Target: <span class="wishlist-target-num">${formatNumber(item.target_value)} ${safeUnit}</span></span>
        </div>
        ${safeNotes ? `<div class="wishlist-notes-text">“${safeNotes}”</div>` : ''}
        <div class="wishlist-actions-row">
          <a href="${ghIssueUrl}" target="_blank" rel="noopener noreferrer" class="wishlist-action-btn gh-issue-link" title="Open formatted GitHub Issue in new tab">
            <span>🐙</span> GitHub Issue
          </a>
          <button type="button" class="wishlist-action-btn activate-quest-btn" data-title="${safeTitle}" data-cat="${cat}" data-val="${item.target_value}" data-unit="${safeUnit}" data-notes="${safeNotes}" title="Promote this proposal to an active live quest">
            <span>🚀</span> Activate Quest
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboardList');
  if (!container || !currentRoomData) return;
  container.innerHTML = '';

  const activeGoals = currentRoomData.active_goals || [];
  const wtUnit = activeGoals.find(g => g.category === 'weight')?.unit || 'lbs';
  const distUnit = activeGoals.find(g => g.category === 'distance')?.unit || 'mi';
  const elevUnit = activeGoals.find(g => g.category === 'elevation')?.unit || 'ft';

  let totalWeight = 0;
  let totalDistance = 0;
  let totalElevation = 0;
  let totalSets = 0;

  const rawMembers = currentRoomData.leaderboard || [];
  rawMembers.forEach(m => {
    totalWeight += m.total_weight || 0;
    totalDistance += m.total_distance || 0;
    totalElevation += m.total_elevation || 0;
    totalSets += m.total_sets || 0;
  });

  // Update badge & multi-metric hero grid
  const setsBadge = document.getElementById('lbTotalSetsBadge');
  if (setsBadge) setsBadge.textContent = `${totalSets} sets logged`;

  const heroWt = document.getElementById('lbHeroWeight');
  const heroDist = document.getElementById('lbHeroDistance');
  const heroElev = document.getElementById('lbHeroElevation');
  if (heroWt) heroWt.textContent = `${formatNumber(totalWeight)} ${wtUnit}`;
  if (heroDist) heroDist.textContent = `${totalDistance.toFixed(1)} ${distUnit}`;
  if (heroElev) heroElev.textContent = `${formatNumber(totalElevation)} ${elevUnit}`;

  const currentUserId = currentRoomData.user_profile?.user_token;

  // Render 3 Vertical Category Sections (Weight, Distance, Elevation)
  const categorySections = [
    {
      category: 'weight',
      icon: '🌲',
      name: 'Weight Hoisted',
      questSubtitle: 'Pando Aspen Clone Quest',
      unit: wtUnit,
      metricKey: 'total_weight',
      totalVal: totalWeight,
      formatter: (v) => `${formatNumber(v)} ${wtUnit}`,
      emptyMsg: 'No weight hoisted yet. Be the first to log a set!',
    },
    {
      category: 'distance',
      icon: '🦌',
      name: 'Distance Traveled',
      questSubtitle: 'Caribou Migration Quest',
      unit: distUnit,
      metricKey: 'total_distance',
      totalVal: totalDistance,
      formatter: (v) => `${v.toFixed(1)} ${distUnit}`,
      emptyMsg: 'No distance recorded yet. Log your run, walk, or cycle!',
    },
    {
      category: 'elevation',
      icon: '🐐',
      name: 'Elevation Climbed',
      questSubtitle: 'Mt. Everest Ascent Quest',
      unit: elevUnit,
      metricKey: 'total_elevation',
      totalVal: totalElevation,
      formatter: (v) => `${formatNumber(v)} ${elevUnit}`,
      emptyMsg: 'No elevation logged yet. Climb some stairs or hills!',
    },
  ];

  // Append any custom active categories from active goals
  const customGoals = activeGoals.filter(g => !['weight', 'distance', 'elevation'].includes(g.category));
  customGoals.forEach(cg => {
    const catActs = (currentRoomData.recent_activities || []).filter(a => a.activity_type === cg.category);
    const catTotal = catActs.reduce((sum, a) => sum + (a.total_metric || 0), 0);
    const userTotals = {};
    catActs.forEach(a => {
      userTotals[a.user_token] = (userTotals[a.user_token] || 0) + (a.total_metric || 0);
    });

    categorySections.push({
      category: cg.category,
      icon: '🎯',
      name: cg.title,
      questSubtitle: `Custom Quest Target: ${formatNumber(cg.target_value)} ${cg.unit}`,
      unit: cg.unit,
      metricKey: null,
      userTotals,
      totalVal: Math.max(cg.current_value || 0, catTotal),
      formatter: (v) => `${formatNumber(v)} ${cg.unit}`,
      emptyMsg: `No activity logged for ${cg.title} yet. Be the first!`,
    });
  });

  categorySections.forEach(sec => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'lb-category-section';
    sectionEl.dataset.category = sec.category;

    const headerEl = document.createElement('div');
    headerEl.className = 'lb-category-header';
    headerEl.innerHTML = `
      <div class="lb-category-heading">
        <div class="lb-category-title-row">
          <span class="lb-category-icon">${sec.icon}</span>
          <h3 class="lb-category-title">${sec.name}</h3>
        </div>
        <span class="lb-category-quest-subtitle">${sec.questSubtitle}</span>
      </div>
      <div class="lb-category-total-badge ${sec.category}">
        <span class="total-badge-label">Squad Total</span>
        <span class="total-badge-val">${sec.formatter(sec.totalVal)}</span>
      </div>
    `;
    sectionEl.appendChild(headerEl);

    // Filter members with contributions in this category, sorted descending
    const catMembers = sec.metricKey
      ? [...rawMembers]
          .filter(m => (m[sec.metricKey] || 0) > 0)
          .sort((a, b) => (b[sec.metricKey] || 0) - (a[sec.metricKey] || 0))
      : [...rawMembers]
          .map(m => ({ ...m, custom_val: sec.userTotals?.[m.user_token] || 0 }))
          .filter(m => m.custom_val > 0)
          .sort((a, b) => b.custom_val - a.custom_val);

    if (catMembers.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'lb-category-empty';
      emptyEl.innerHTML = `
        <span class="empty-icon">${sec.icon}</span>
        <span class="empty-text">${sec.emptyMsg}</span>
      `;
      sectionEl.appendChild(emptyEl);
    } else {
      const listEl = document.createElement('div');
      listEl.className = 'lb-category-list';

      catMembers.forEach((member, idx) => {
        const isMe = member.user_token === currentUserId;
        let rankBadge = '';
        let rankClass = '';
        if (idx === 0) { rankBadge = '🥇'; rankClass = 'rank-gold'; }
        else if (idx === 1) { rankBadge = '🥈'; rankClass = 'rank-silver'; }
        else if (idx === 2) { rankBadge = '🥉'; rankClass = 'rank-bronze'; }
        else { rankBadge = `#${idx + 1}`; rankClass = 'rank-other'; }

        const val = sec.metricKey ? (member[sec.metricKey] || 0) : (member.custom_val || 0);
        const pct = sec.totalVal > 0 ? ((val / sec.totalVal) * 100).toFixed(1) : '0.0';

        const card = document.createElement('div');
        card.className = `leaderboard-card ${isMe ? 'is-me' : ''}`;

        card.innerHTML = `
          <div class="lb-card-top-row">
            <div class="leaderboard-user">
              <span class="lb-rank-badge ${rankClass}">${rankBadge}</span>
              <div class="user-avatar" style="background-color: ${member.avatar_color || '#10b981'}">
                ${(member.nickname || 'L').substring(0, 1).toUpperCase()}
              </div>
              <div class="user-details">
                <div class="user-name-row">
                  <span class="user-nickname-text">${FlyToast.escape(member.nickname)}</span>
                </div>
              </div>
            </div>
            <div class="leaderboard-score">
              <div class="score-main ${sec.category}">${sec.formatter(val)}</div>
            </div>
          </div>
          <div class="lb-card-bottom-row">
            <div class="lb-meta-badges">
              ${isMe ? '<span class="badge-me">YOU</span>' : ''}
              ${member.is_daily_mvp ? '<span class="mvp-crown" title="Daily Titan">👑 Titan</span>' : ''}
              <span class="user-stats-sub">${member.total_sets || 0} sets logged</span>
            </div>
            <div class="score-pct">${pct}% of Crew</div>
          </div>
        `;
        listEl.appendChild(card);
      });

      sectionEl.appendChild(listEl);
    }

    container.appendChild(sectionEl);
  });
}

function renderFeed() {
  const container = document.getElementById('activityFeedList');
  container.innerHTML = '';

  const activities = currentRoomData.recent_activities.filter(act => {
    if (activityFilter === 'my') {
      return act.user_token === currentRoomData.user_profile.user_token;
    }
    return true;
  });

  if (activities.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No ${activityFilter === 'my' ? 'personal' : 'crew'} activity recorded yet.</div>`;
    return;
  }

  activities.forEach(act => {
    const item = document.createElement('div');
    item.className = 'activity-item';

    const isMe = act.user_token === currentRoomData.user_profile.user_token;
    let metricText = '';
    if (act.activity_type === 'weight') {
      metricText = `+${formatNumber(act.total_metric)} lbs`;
    } else if (act.activity_type === 'distance') {
      metricText = `+${act.total_metric} mi`;
    } else if (act.activity_type === 'elevation') {
      metricText = `+${formatNumber(act.total_metric)} ft`;
    } else {
      const matchGoal = (currentRoomData.active_goals || []).find(g => g.id === act.goal_id || g.category === act.activity_type);
      const unit = matchGoal?.unit || '';
      metricText = `+${formatNumber(act.total_metric)} ${unit}`.trim();
    }

    let detailStr = act.activity_type === 'weight'
      ? `${act.sets}x${act.reps} @ ${act.weight_per_rep}lbs`
      : (act.sets > 1 || act.reps > 1
          ? `${act.exercise_name} (${act.sets}x${act.reps})`
          : `${act.exercise_name}`);

    item.innerHTML = `
      <div class="activity-left">
        <div class="user-avatar" style="background-color: ${act.user_avatar_color}; width: 32px; height: 32px; font-size: 0.85rem;">
          ${act.user_nickname.substring(0, 1).toUpperCase()}
        </div>
        <div class="activity-text">
          <div><strong class="activity-user">${FlyToast.escape(act.user_nickname)}</strong> <span style="color: var(--text-secondary);">${FlyToast.escape(act.exercise_name)} (${detailStr})</span></div>
          <div class="activity-meta">${act.notes ? `"${FlyToast.escape(act.notes)}" • ` : ''}${formatTimeAgo(act.created_at)}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="activity-metric-badge">${metricText}</span>
        ${isMe ? `<button class="delete-btn" data-id="${act.id}" title="Undo / Delete">✕</button>` : ''}
      </div>
    `;

    if (isMe) {
      const delBtn = item.querySelector('.delete-btn');
      delBtn.addEventListener('click', () => deleteActivity(act.id));
    }

    container.appendChild(item);
  });
}

function formatTimeAgo(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch (_) {
    return '';
  }
}

// 4. Realtime WebSocket Hub
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/ws?room=${roomSlug}&token=${client.token}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsEvent(msg);
      } catch (e) {
        console.error('Invalid WS payload:', e);
      }
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  } catch (err) {
    console.warn('WS connection failed, falling back:', err);
  }
}

function handleWsEvent(msg) {
  if (msg.event === 'cheer_reaction') {
    diorama.spawnEmojiReaction(msg.payload.emoji);
    FlyToast.info(`${msg.payload.user_nickname} sent ${msg.payload.emoji}!`);
  } else if (msg.event === 'room_renamed') {
    if (msg.payload && msg.payload.room) {
      if (currentRoomData && currentRoomData.room) {
        currentRoomData.room.name = msg.payload.room.name;
      }
      const label = document.getElementById('roomNameLabel');
      if (label) label.textContent = msg.payload.room.name;
      const editInput = document.getElementById('editRoomNameInput');
      if (editInput) editInput.value = msg.payload.room.name;
      if (msg.sender_token !== client.token) {
        FlyToast.info(`Squad renamed to "${msg.payload.room.name}"`);
      }
    }
  } else if (msg.event === 'activity_logged' || msg.event === 'batch_activities_logged' || msg.event === 'activity_deleted') {
    loadRoomState();
    if (msg.event === 'activity_logged') {
      const act = msg.payload.activity;
      const metricLabel = act.activity_type === 'weight' ? `+${formatNumber(act.total_metric)} lbs` : `+${act.total_metric}`;
      diorama.spawnCelebrationBurst(metricLabel);
      if (msg.sender_token !== client.token) {
        FlyToast.success(`${act.user_nickname} hoisted ${metricLabel}!`);
      }
    }
  } else if (msg.event === 'wishlist_added') {
    loadRoomState();
    if (msg.payload && msg.payload.item && msg.sender_token !== client.token) {
      FlyToast.info(`✨ New quest proposed: "${msg.payload.item.title}"`);
    }
  } else if (msg.event === 'goal_created') {
    loadRoomState();
    if (msg.payload && msg.sender_token !== client.token) {
      FlyToast.success(`🚀 New quest activated: "${msg.payload.title}"!`);
    }
  }
}

// 5. Logging Modes & Steppers
function setupLoggingTabs() {
  const tabStepper = document.getElementById('modeStepperBtn');
  const tabWorkout = document.getElementById('modeWorkoutBtn');
  const tabFastAdd = document.getElementById('modeFastAddBtn');

  const panelStepper = document.getElementById('panelStepper');
  const panelWorkout = document.getElementById('panelWorkout');
  const panelFastAdd = document.getElementById('panelFastAdd');

  function setMode(mode) {
    [tabStepper, tabWorkout, tabFastAdd].forEach(t => t.classList.remove('active'));
    [panelStepper, panelWorkout, panelFastAdd].forEach(p => p.style.display = 'none');

    if (mode === 'stepper') {
      tabStepper.classList.add('active');
      panelStepper.style.display = 'block';
    } else if (mode === 'workout') {
      tabWorkout.classList.add('active');
      panelWorkout.style.display = 'block';
    } else if (mode === 'fastadd') {
      tabFastAdd.classList.add('active');
      panelFastAdd.style.display = 'block';
    }
  }

  tabStepper.addEventListener('click', () => setMode('stepper'));
  tabWorkout.addEventListener('click', () => setMode('workout'));
  tabFastAdd.addEventListener('click', () => setMode('fastadd'));
}

function setupSteppers() {
  const wtInput = document.getElementById('stepperWeight');
  const repsInput = document.getElementById('stepperReps');
  const impactVal = document.getElementById('computedImpactVal');

  function getCustomExercises() {
    try {
      const stored = localStorage.getItem('tardigrade_custom_exercises');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomExercise(name) {
    if (!name || typeof name !== 'string') return;
    const clean = name.trim();
    if (!clean) return;
    const list = getCustomExercises();
    if (!list.some(e => e.toLowerCase() === clean.toLowerCase())) {
      list.push(clean);
      try {
        localStorage.setItem('tardigrade_custom_exercises', JSON.stringify(list));
      } catch (e) {}
    }
  }

  function getCustomExerciseOptionsHtml() {
    const customList = getCustomExercises();
    if (customList.length === 0) return '';
    return customList.map(ex => `<option value="${FlyToast.escape(ex)}">✨ ${FlyToast.escape(ex)}</option>`).join('');
  }

  window.updateStepperForGoal = function(goal) {
    const exSelect = document.getElementById('stepperExercise');
    const exLabel = document.getElementById('stepperExerciseLabel');
    const metricLabel = document.getElementById('stepperMetricLabel');
    const countLabel = document.getElementById('stepperCountLabel');
    const routeLabel = document.getElementById('computedImpactRoute');
    const metricPresets = document.getElementById('stepperMetricPresets');
    const customOpts = getCustomExerciseOptionsHtml();

    if (!goal || goal.category === 'weight') {
      if (exLabel) exLabel.textContent = 'Exercise';
      if (metricLabel) metricLabel.textContent = `Weight (${goal?.unit || 'lbs'})`;
      if (countLabel) countLabel.textContent = 'Reps';
      if (routeLabel) routeLabel.textContent = `→ Auto-Routes to ${FlyToast.escape(goal?.title || 'Pando')} 🌲`;
      if (exSelect) {
        exSelect.innerHTML = `
          <option value="Back Squat">🏋️ Back Squat</option>
          <option value="Deadlift">🏋️ Deadlift</option>
          <option value="Bench Press">🏋️ Bench Press</option>
          <option value="Leg Press">🏋️ Leg Press</option>
          <option value="Overhead Press">🏋️ Overhead Press</option>
          <option value="Barbell Row">🏋️ Barbell Row</option>
          <option value="Dumbbell Lunge">🏋️ Dumbbell Lunge</option>
          <option value="Bicep Curl">🏋️ Bicep Curl</option>
          ${customOpts}
          <option value="__add_custom__">✨ + Add Custom Exercise...</option>
        `;
      }
      if (metricPresets) {
        metricPresets.innerHTML = `
          <button class="preset-chip" data-delta="-45">-45</button>
          <button class="preset-chip" data-delta="-5">-5</button>
          <button class="preset-chip" data-delta="+5">+5</button>
          <button class="preset-chip" data-delta="+45">+45</button>
        `;
        attachMetricPresetListeners();
      }
    } else if (goal.category === 'elevation') {
      if (exLabel) exLabel.textContent = 'Climb / Elevation Exercise';
      if (metricLabel) metricLabel.textContent = `Elevation Gain (${goal.unit || 'ft'})`;
      if (countLabel) countLabel.textContent = 'Sets / Floors';
      if (routeLabel) routeLabel.textContent = `→ Auto-Routes to ${FlyToast.escape(goal.title)} 🐐`;
      if (exSelect) {
        exSelect.innerHTML = `
          <option value="Stair Climber">🧗 Stair Climber</option>
          <option value="Incline Treadmill">🏔️ Incline Treadmill</option>
          <option value="Mountain Hike">🥾 Mountain Hike</option>
          <option value="Box Step-ups">📦 Box Step-ups</option>
          <option value="Hill Sprints">🏃 Hill Sprints</option>
          ${customOpts}
          <option value="__add_custom__">✨ + Add Custom Exercise...</option>
        `;
      }
      if (wtInput.value === '135' || parseFloat(wtInput.value) <= 0) {
        wtInput.value = '100';
      }
      if (metricPresets) {
        metricPresets.innerHTML = `
          <button class="preset-chip" data-delta="-100">-100</button>
          <button class="preset-chip" data-delta="-25">-25</button>
          <button class="preset-chip" data-delta="+25">+25</button>
          <button class="preset-chip" data-delta="+100">+100</button>
        `;
        attachMetricPresetListeners();
      }
    } else if (goal.category === 'distance') {
      if (exLabel) exLabel.textContent = 'Distance / Cardio Exercise';
      if (metricLabel) metricLabel.textContent = `Distance (${goal.unit || 'mi'})`;
      if (countLabel) countLabel.textContent = 'Laps / Sets';
      if (routeLabel) routeLabel.textContent = `→ Auto-Routes to ${FlyToast.escape(goal.title)} 🦌`;
      if (exSelect) {
        exSelect.innerHTML = `
          <option value="Outdoor Run">🏃 Outdoor Run</option>
          <option value="Trail Walk">🚶 Trail Walk</option>
          <option value="Road Cycling">🚴 Road Cycling</option>
          <option value="Rowing Machine">🚣 Rowing Machine</option>
          <option value="Treadmill Run">🏃 Treadmill Run</option>
          ${customOpts}
          <option value="__add_custom__">✨ + Add Custom Exercise...</option>
        `;
      }
      if (wtInput.value === '135' || parseFloat(wtInput.value) <= 0) {
        wtInput.value = '3';
      }
      if (metricPresets) {
        metricPresets.innerHTML = `
          <button class="preset-chip" data-delta="-2">-2</button>
          <button class="preset-chip" data-delta="-0.5">-0.5</button>
          <button class="preset-chip" data-delta="+0.5">+0.5</button>
          <button class="preset-chip" data-delta="+2">+2</button>
        `;
        attachMetricPresetListeners();
      }
    } else {
      // Custom Quest Category
      if (exLabel) exLabel.textContent = `${goal.category.toUpperCase()} Movement`;
      if (metricLabel) metricLabel.textContent = `${goal.unit || 'Metric'}`;
      if (countLabel) countLabel.textContent = 'Sets / Reps';
      if (routeLabel) routeLabel.textContent = `→ Auto-Routes to ${FlyToast.escape(goal.title)} 🎯`;
      if (exSelect) {
        exSelect.innerHTML = `
          <option value="${FlyToast.escape(goal.title)}">${FlyToast.escape(goal.title)}</option>
          <option value="Custom Movement">⚡ Custom Movement</option>
          <option value="Rep Count">🔢 Rep Count</option>
          ${customOpts}
          <option value="__add_custom__">✨ + Add Custom Exercise...</option>
        `;
      }
      if (metricPresets) {
        metricPresets.innerHTML = `
          <button class="preset-chip" data-delta="-50">-50</button>
          <button class="preset-chip" data-delta="-10">-10</button>
          <button class="preset-chip" data-delta="+10">+10</button>
          <button class="preset-chip" data-delta="+50">+50</button>
        `;
        attachMetricPresetListeners();
      }
    }
    updateImpact();
  };

  function updateImpact() {
    const activeGoals = currentRoomData?.active_goals || [];
    const currentGoal = activeGoals[selectedGoalIndex] || { category: 'weight', unit: 'lbs' };
    const wt = parseFloat(wtInput.value) || 0;
    const reps = parseInt(repsInput.value, 10) || 0;
    const total = wt * reps;

    if (currentGoal.category === 'distance') {
      const formatted = (Math.round(total * 100) / 100).toLocaleString('en-US');
      impactVal.textContent = `${formatted} ${currentGoal.unit || 'mi'}`;
    } else {
      impactVal.textContent = `${formatNumber(total)} ${currentGoal.unit || 'lbs'}`;
    }
  }

  function attachMetricPresetListeners() {
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.onclick = () => {
        const delta = parseFloat(chip.dataset.delta);
        if (!isNaN(delta)) {
          wtInput.value = Math.max(0, (parseFloat(wtInput.value) || 0) + delta);
          updateImpact();
        }
      };
    });
  }

  document.getElementById('wtMinusBtn').addEventListener('click', () => {
    const activeGoals = currentRoomData?.active_goals || [];
    const currentGoal = activeGoals[selectedGoalIndex] || { category: 'weight' };
    const step = currentGoal.category === 'distance' ? 1 : 10;
    wtInput.value = Math.max(0, (parseFloat(wtInput.value) || 0) - step);
    updateImpact();
  });

  document.getElementById('wtPlusBtn').addEventListener('click', () => {
    const activeGoals = currentRoomData?.active_goals || [];
    const currentGoal = activeGoals[selectedGoalIndex] || { category: 'weight' };
    const step = currentGoal.category === 'distance' ? 1 : 10;
    wtInput.value = (parseFloat(wtInput.value) || 0) + step;
    updateImpact();
  });

  attachMetricPresetListeners();

  document.getElementById('repsMinusBtn').addEventListener('click', () => {
    repsInput.value = Math.max(1, (parseInt(repsInput.value, 10) || 1) - 1);
    updateImpact();
  });

  document.getElementById('repsPlusBtn').addEventListener('click', () => {
    repsInput.value = (parseInt(repsInput.value, 10) || 1) + 1;
    updateImpact();
  });

  document.querySelectorAll('.preset-chip-rep').forEach(chip => {
    chip.addEventListener('click', () => {
      repsInput.value = parseInt(chip.dataset.val, 10);
      updateImpact();
    });
  });

  wtInput.addEventListener('input', updateImpact);
  repsInput.addEventListener('input', updateImpact);

  // Custom Exercise Dropdown & Input Controls
  const toggleCustomExBtn = document.getElementById('toggleCustomExBtn');
  const customExRow = document.getElementById('customExerciseRow');
  const customExInput = document.getElementById('customExerciseInput');
  const addCustomExBtn = document.getElementById('addCustomExerciseBtn');
  const cancelCustomExBtn = document.getElementById('cancelCustomExerciseBtn');
  const stepperExSelect = document.getElementById('stepperExercise');

  let lastSelectedEx = stepperExSelect ? stepperExSelect.value : '';

  if (stepperExSelect) {
    stepperExSelect.addEventListener('change', () => {
      if (stepperExSelect.value === '__add_custom__') {
        showCustomExerciseInput();
      } else {
        lastSelectedEx = stepperExSelect.value;
      }
    });
  }

  function showCustomExerciseInput() {
    if (customExRow) {
      customExRow.style.display = 'flex';
      if (customExInput) {
        customExInput.value = '';
        setTimeout(() => customExInput.focus(), 60);
      }
    }
  }

  function hideCustomExerciseInput() {
    if (customExRow) {
      customExRow.style.display = 'none';
      if (customExInput) customExInput.value = '';
    }
    if (stepperExSelect && stepperExSelect.value === '__add_custom__') {
      stepperExSelect.value = lastSelectedEx || (stepperExSelect.options[0] ? stepperExSelect.options[0].value : '');
    }
  }

  function handleAddCustomExercise() {
    const rawName = customExInput ? customExInput.value.trim() : '';
    if (!rawName) {
      FlyToast.error('Please enter an exercise name');
      return;
    }
    saveCustomExercise(rawName);

    // Add to dropdown if not present
    let opt = Array.from(stepperExSelect.options).find(o => o.value.toLowerCase() === rawName.toLowerCase());
    if (!opt) {
      opt = document.createElement('option');
      opt.value = rawName;
      opt.textContent = `✨ ${rawName}`;
      const customOpt = stepperExSelect.querySelector('option[value="__add_custom__"]');
      if (customOpt) {
        stepperExSelect.insertBefore(opt, customOpt);
      } else {
        stepperExSelect.appendChild(opt);
      }
    }
    stepperExSelect.value = opt.value;
    lastSelectedEx = opt.value;
    hideCustomExerciseInput();
    FlyToast.success(`Added "${rawName}" to exercises!`);
  }

  if (toggleCustomExBtn) {
    toggleCustomExBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (customExRow && customExRow.style.display === 'flex') {
        hideCustomExerciseInput();
      } else {
        showCustomExerciseInput();
      }
    });
  }

  if (addCustomExBtn) {
    addCustomExBtn.addEventListener('click', handleAddCustomExercise);
  }

  if (customExInput) {
    customExInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomExercise();
      } else if (e.key === 'Escape') {
        hideCustomExerciseInput();
      }
    });
  }

  if (cancelCustomExBtn) {
    cancelCustomExBtn.addEventListener('click', hideCustomExerciseInput);
  }

  document.getElementById('logSetBtn').addEventListener('click', async () => {
    let exercise = document.getElementById('stepperExercise').value;
    if (exercise === '__add_custom__') {
      exercise = 'Custom Exercise';
    }
    const metricVal = parseFloat(wtInput.value) || 0;
    const reps = parseInt(repsInput.value, 10) || 1;
    const activeGoals = currentRoomData?.active_goals || [];
    const currentGoal = activeGoals[selectedGoalIndex] || { category: 'weight' };

    const totalMetric = currentGoal.category === 'weight' ? metricVal * reps : metricVal * reps;

    await executeLogActivity({
      room_slug: roomSlug,
      activity_type: currentGoal.category,
      exercise_name: exercise,
      sets: 1,
      reps,
      weight_per_rep: currentGoal.category === 'weight' ? metricVal : 0,
      distance_val: currentGoal.category === 'distance' ? totalMetric : 0,
      elevation_val: currentGoal.category === 'elevation' ? totalMetric : 0,
      total_metric: totalMetric,
      goal_id: currentGoal.id,
    });
  });

  document.getElementById('repeatSetBtn').addEventListener('click', async () => {
    if (lastLoggedSet) {
      await executeLogActivity({
        ...lastLoggedSet,
        notes: 'Repeat set',
      });
      return;
    }
    document.getElementById('logSetBtn').click();
  });

  updateImpact();
}

async function executeLogActivity(req) {
  lastLoggedSet = req;

  if (navigator.onLine) {
    try {
      const res = await client.post('/activities', req);
      if (res && res.success) {
        const unit = res.data.activity_type === 'weight' ? 'lbs' : res.data.activity_type === 'elevation' ? 'ft' : 'mi';
        FlyToast.success(`Logged ${formatNumber(res.data.total_metric)} ${unit}!`);
        await loadRoomState();
        diorama.spawnCelebrationBurst(`+${formatNumber(res.data.total_metric)} ${unit}`);
        return;
      }
    } catch (err) {
      console.warn('Online log failed, fallback to queue:', err);
    }
  }

  offlineSync.enqueue(req);
  FlyToast.info('Logged offline! Will auto-sync when connection returns.');
}

// 6. Fast-Add Handler
function setupFastAdd() {
  const catSelect = document.getElementById('fastAddCategory');
  const amtInput = document.getElementById('fastAddInput');
  const presetsContainer = document.getElementById('fastAddPresets');

  function updatePresets() {
    const cat = catSelect.value;
    if (cat === 'weight') {
      presetsContainer.innerHTML = `
        <button class="preset-chip-fast" data-amt="500">+500</button>
        <button class="preset-chip-fast" data-amt="1000">+1,000</button>
        <button class="preset-chip-fast" data-amt="2500">+2,500</button>
        <button class="preset-chip-fast" data-amt="5000">+5,000</button>
      `;
    } else if (cat === 'distance') {
      presetsContainer.innerHTML = `
        <button class="preset-chip-fast" data-amt="1">+1 mi</button>
        <button class="preset-chip-fast" data-amt="3">+3 mi</button>
        <button class="preset-chip-fast" data-amt="5">+5 mi</button>
        <button class="preset-chip-fast" data-amt="10">+10 mi</button>
      `;
    } else {
      presetsContainer.innerHTML = `
        <button class="preset-chip-fast" data-amt="250">+250 ft</button>
        <button class="preset-chip-fast" data-amt="500">+500 ft</button>
        <button class="preset-chip-fast" data-amt="1000">+1,000 ft</button>
        <button class="preset-chip-fast" data-amt="2500">+2,500 ft</button>
      `;
    }

    presetsContainer.querySelectorAll('.preset-chip-fast').forEach(b => {
      b.addEventListener('click', () => {
        amtInput.value = (parseFloat(amtInput.value) || 0) + parseFloat(b.dataset.amt);
      });
    });
  }

  catSelect.addEventListener('change', updatePresets);
  updatePresets();

  document.getElementById('submitFastAddBtn').addEventListener('click', async () => {
    const cat = catSelect.value;
    const val = parseFloat(amtInput.value) || 0;
    if (val <= 0) {
      FlyToast.error('Please enter a positive amount');
      return;
    }

    const payload = {
      room_slug: roomSlug,
      activity_type: cat,
      exercise_name: 'Fast Add',
      total_metric: val,
      distance_val: cat === 'distance' ? val : 0,
      elevation_val: cat === 'elevation' ? val : 0,
      weight_per_rep: cat === 'weight' ? val : 0,
      sets: 1,
      reps: 1,
    };

    await executeLogActivity(payload);
    amtInput.value = '';
  });
}

// 7. Full Workout Session Mode (Clean Placeholders & Quick Chips)
function setupWorkoutMode() {
  const container = document.getElementById('workoutEntriesContainer');

  function addRow(ex = '', sets = '', reps = '', wt = '') {
    const row = document.createElement('div');
    row.className = 'workout-entry-row';
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.style.alignItems = 'center';

    row.innerHTML = `
      <input type="text" class="form-input row-ex" placeholder="Exercise (e.g. Squat)" value="${ex}" style="flex: 2; padding: 8px;">
      <input type="number" class="form-input row-sets" placeholder="Sets" value="${sets}" style="width: 60px; padding: 8px;">
      <input type="number" class="form-input row-reps" placeholder="Reps" value="${reps}" style="width: 60px; padding: 8px;">
      <input type="number" class="form-input row-wt" placeholder="Lbs" value="${wt}" style="width: 75px; padding: 8px;">
      <button class="delete-btn row-del" style="font-size: 1.1rem; padding: 4px 8px;">✕</button>
    `;

    row.querySelector('.row-del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  document.getElementById('addWorkoutRowBtn').addEventListener('click', () => addRow());

  document.querySelectorAll('.quick-add-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const exName = chip.dataset.ex;
      addRow(exName);
    });
  });

  addRow('', '', '', '');
  addRow('', '', '', '');

  document.getElementById('submitWorkoutBtn').addEventListener('click', async () => {
    const rows = container.querySelectorAll('.workout-entry-row');
    const activities = [];

    rows.forEach(r => {
      const ex = r.querySelector('.row-ex').value.trim();
      const sets = parseInt(r.querySelector('.row-sets').value, 10);
      const reps = parseInt(r.querySelector('.row-reps').value, 10);
      const wt = parseFloat(r.querySelector('.row-wt').value);

      if (ex || !isNaN(wt) || !isNaN(sets)) {
        activities.push({
          room_slug: roomSlug,
          activity_type: 'weight',
          exercise_name: ex || 'Lift',
          sets: isNaN(sets) || sets <= 0 ? 1 : sets,
          reps: isNaN(reps) || reps <= 0 ? 10 : reps,
          weight_per_rep: isNaN(wt) || wt < 0 ? 0 : wt,
        });
      }
    });

    if (activities.length === 0) {
      FlyToast.error('Please enter at least one exercise row');
      return;
    }

    if (navigator.onLine) {
      try {
        const res = await client.post('/activities/batch', {
          room_slug: roomSlug,
          activities,
        });
        if (res && res.success) {
          FlyToast.success(`Submitted ${activities.length} exercises!`);
          container.innerHTML = '';
          addRow('', '', '', '');
          await loadRoomState();
          return;
        }
      } catch (e) {
        console.warn('Batch submit offline fallback:', e);
      }
    }

    activities.forEach(a => offlineSync.enqueue(a));
    FlyToast.info(`Logged ${activities.length} exercises offline!`);
    container.innerHTML = '';
    addRow('', '', '', '');
  });
}

// 8. Cheers & Reactions
function setupCheers() {
  document.querySelectorAll('.cheer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji;
      diorama.spawnEmojiReaction(emoji);

      try {
        await client.post('/cheer', { room_slug: roomSlug, emoji });
      } catch (_) {}
    });
  });
}

// 9. Activity Deletion
async function deleteActivity(id) {
  if (!confirm('Undo / delete this activity?')) return;
  try {
    const res = await client.delete(`/activities/${id}`);
    if (res && res.success) {
      FlyToast.info('Activity removed.');
      await loadRoomState();
    }
  } catch (err) {
    FlyToast.error('Failed to delete activity');
  }
}

// 10. Sheet Importer Logic
function setupSheetImporter() {
  const importModal = document.getElementById('importModal');
  const openBtn = document.getElementById('openImportModalBtn');
  const closeBtn = document.getElementById('closeImportBtn');
  const pasteArea = document.getElementById('importPasteArea');
  const userNickInput = document.getElementById('importUserNick');
  const userColorSelect = document.getElementById('importUserColor');
  const summaryBox = document.getElementById('importSummaryBox');
  const summaryText = document.getElementById('importSummaryText');
  const tonnageText = document.getElementById('importTonnageText');
  const executeBtn = document.getElementById('executeImportBtn');

  let parsedActivities = [];

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      importModal.classList.remove('hidden');
      parsePastedData();
    });
  }

  closeBtn.addEventListener('click', () => {
    importModal.classList.add('hidden');
  });

  function parsePastedData() {
    const raw = pasteArea.value.trim();
    if (!raw) {
      summaryBox.style.display = 'none';
      executeBtn.disabled = true;
      parsedActivities = [];
      return;
    }

    const lines = raw.split(/\r?\n/);
    parsedActivities = [];
    let totalTonnage = 0;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/[\t,;]+/).map(p => p.trim()).filter(Boolean);

      let weight = 0;
      let reps = 1;
      let sets = 1;
      let calculatedTotal = 0;

      if (parts.length >= 2) {
        weight = parseFloat(parts[0]) || 0;
        reps = parseInt(parts[1], 10) || 1;
        calculatedTotal = weight * reps;
      } else if (parts.length === 1) {
        const spaceParts = trimmed.split(/\s+/);
        if (spaceParts.length >= 2) {
          weight = parseFloat(spaceParts[0]) || 0;
          reps = parseInt(spaceParts[1], 10) || 1;
          calculatedTotal = weight * reps;
        } else {
          calculatedTotal = parseFloat(parts[0]) || 0;
          weight = calculatedTotal;
          reps = 1;
        }
      }

      if (calculatedTotal > 0) {
        totalTonnage += calculatedTotal;
        parsedActivities.push({
          room_slug: roomSlug,
          activity_type: 'weight',
          exercise_name: 'Sheet Lift',
          sets,
          reps,
          weight_per_rep: weight,
          total_metric: calculatedTotal,
          notes: `Sheet Row #${idx + 1}`,
        });
      }
    });

    if (parsedActivities.length > 0) {
      summaryBox.style.display = 'flex';
      summaryText.textContent = `Parsed: ${parsedActivities.length} sets`;
      tonnageText.textContent = `+${formatNumber(totalTonnage)} lbs`;
      executeBtn.disabled = false;
      executeBtn.textContent = `Import ${parsedActivities.length} Sets (${formatNumber(totalTonnage)} lbs)`;
    } else {
      summaryBox.style.display = 'none';
      executeBtn.disabled = true;
    }
  }

  pasteArea.addEventListener('input', parsePastedData);

  executeBtn.addEventListener('click', async () => {
    if (parsedActivities.length === 0) return;

    const nickname = userNickInput.value.trim() || 'GymMate';
    const avatarColor = userColorSelect.value;

    try {
      executeBtn.disabled = true;
      executeBtn.textContent = 'Importing...';

      const res = await client.post('/activities/batch', {
        room_slug: roomSlug,
        user_nickname: nickname,
        user_avatar_color: avatarColor,
        activities: parsedActivities,
      });

      if (res && res.success) {
        importModal.classList.add('hidden');
        pasteArea.value = '';
        FlyToast.success(`Successfully imported ${parsedActivities.length} sets for ${nickname}!`);
        await loadRoomState();
        diorama.spawnCelebrationBurst(`+${parsedActivities.length} sets!`);
      }
    } catch (err) {
      FlyToast.error('Import failed: ' + err.message);
    } finally {
      executeBtn.disabled = false;
      parsePastedData();
    }
  });
}

// 11. Unified User Profile & Squad Hub Modal
function setupModals() {
  const profileModal = document.getElementById('profileModal');
  const roomModal = document.getElementById('roomModal');
  const aboutModal = document.getElementById('aboutModal');
  const nickInput = document.getElementById('nickInput');
  let selectedColor = '#10b981';

  const tabBtnProfile = document.getElementById('tabBtnProfile');
  const tabBtnSquad = document.getElementById('tabBtnSquad');
  const hubPaneProfile = document.getElementById('hubPaneProfile');
  const hubPaneSquad = document.getElementById('hubPaneSquad');

  const roomSlugInput = document.getElementById('roomSlugInput');
  const newRoomNameInput = document.getElementById('newRoomNameInput');
  const qrImg = document.getElementById('roomQrImage');
  const editRoomNameInput = document.getElementById('editRoomNameInput');
  const saveRoomNameBtn = document.getElementById('saveRoomNameBtn');
  const shareRoomUrlInput = document.getElementById('shareRoomUrlInput');
  const copyRoomUrlBtn = document.getElementById('copyRoomUrlBtn');
  const nativeShareBtn = document.getElementById('nativeShareBtn');
  const currentRoomSlugLabel = document.getElementById('currentRoomSlugLabel');

  function populateSquadHubFields() {
    if (roomSlugInput) roomSlugInput.value = roomSlug;
    if (currentRoomSlugLabel) {
      currentRoomSlugLabel.textContent = `slug: ${roomSlug}`;
    }
    if (currentRoomData && currentRoomData.room) {
      if (editRoomNameInput) editRoomNameInput.value = currentRoomData.room.name;
      const label = document.getElementById('roomNameLabel');
      if (label) label.textContent = currentRoomData.room.name;
    }
    const roomUrl = `${window.location.origin}/r/${roomSlug}`;
    if (shareRoomUrlInput) {
      shareRoomUrlInput.value = roomUrl;
    }
    if (qrImg) {
      qrImg.src = `/api/qr?url=${encodeURIComponent(roomUrl)}`;
    }
    if (nativeShareBtn && typeof navigator.share === 'function') {
      nativeShareBtn.style.display = 'block';
    }
  }

  function selectHubTab(tabName) {
    if (tabName === 'squad') {
      if (tabBtnSquad) {
        tabBtnSquad.classList.add('active');
        tabBtnSquad.setAttribute('aria-selected', 'true');
      }
      if (tabBtnProfile) {
        tabBtnProfile.classList.remove('active');
        tabBtnProfile.setAttribute('aria-selected', 'false');
      }
      populateSquadHubFields();
      if (hubPaneSquad) {
        hubPaneSquad.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (tabBtnProfile) {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
      }
      if (tabBtnSquad) {
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
      if (hubPaneProfile) {
        hubPaneProfile.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  if (tabBtnProfile) tabBtnProfile.addEventListener('click', () => selectHubTab('profile'));
  if (tabBtnSquad) tabBtnSquad.addEventListener('click', () => selectHubTab('squad'));

  // Sync active nav pill when user scrolls within consolidated hub
  const hubBox = profileModal ? profileModal.querySelector('.hub-modal-box') : null;
  if (hubBox && hubPaneSquad && tabBtnProfile && tabBtnSquad) {
    hubBox.addEventListener('scroll', () => {
      const squadTop = hubPaneSquad.offsetTop - hubBox.scrollTop;
      if (squadTop <= 110) {
        tabBtnSquad.classList.add('active');
        tabBtnSquad.setAttribute('aria-selected', 'true');
        tabBtnProfile.classList.remove('active');
        tabBtnProfile.setAttribute('aria-selected', 'false');
      } else {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
    }, { passive: true });
  }

  function openHub(tab = 'profile') {
    if (currentRoomData && currentRoomData.user_profile) {
      if (nickInput) nickInput.value = currentRoomData.user_profile.nickname;
      selectedColor = currentRoomData.user_profile.avatar_color;
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === selectedColor);
      });
    }
    populateSquadHubFields();
    if (profileModal) profileModal.classList.remove('hidden');
    if (roomModal) roomModal.classList.remove('hidden');

    if (tab === 'squad') {
      selectHubTab('squad');
    } else {
      if (tabBtnProfile) {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
      }
      if (tabBtnSquad) {
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
      if (hubBox) hubBox.scrollTop = 0;
    }
  }

  function closeHub() {
    if (profileModal) profileModal.classList.add('hidden');
    if (roomModal) roomModal.classList.add('hidden');
  }

  window.openRoomModal = () => openHub('squad');

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', () => openHub('profile'));

  const roomBtn = document.getElementById('roomBtn');
  if (roomBtn) roomBtn.addEventListener('click', () => openHub('squad'));

  const closeProfileBtn = document.getElementById('closeProfileBtn');
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeHub);

  const closeRoomBtn = document.getElementById('closeRoomBtn');
  if (closeRoomBtn) closeRoomBtn.addEventListener('click', closeHub);

  // Dark / Light Mode inside profile
  const darkBtn = document.getElementById('themeDarkBtn');
  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      FlyTheme.apply('dark');
      FlyToast.info('Dark mode enabled');
    });
  }

  const lightBtn = document.getElementById('themeLightBtn');
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      FlyTheme.apply('light');
      FlyToast.info('Light mode enabled');
    });
  }

  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
    });
  });

  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const nick = nickInput.value.trim();
      try {
        const res = await client.post('/users/profile', {
          nickname: nick,
          avatar_color: selectedColor,
        });
        if (res && res.success) {
          closeHub();
          FlyToast.success('Profile updated!');
          await loadRoomState();
        }
      } catch (e) {
        FlyToast.error('Failed to save profile');
      }
    });
  }

  // Rename Squad
  if (saveRoomNameBtn && editRoomNameInput) {
    saveRoomNameBtn.addEventListener('click', async () => {
      const newName = editRoomNameInput.value.trim();
      if (!newName) {
        FlyToast.error('Please enter a squad name');
        return;
      }
      if (newName.length > 50) {
        FlyToast.error('Squad name must be 50 characters or less');
        return;
      }

      try {
        const res = await client.post(`/room/${roomSlug}/name`, { name: newName });
        if (res && res.success) {
          if (currentRoomData && currentRoomData.room) {
            currentRoomData.room.name = res.room.name;
          }
          const label = document.getElementById('roomNameLabel');
          if (label) label.textContent = res.room.name;
          FlyToast.success(`Squad renamed to "${res.room.name}"!`);
        } else {
          FlyToast.error(res?.error || 'Failed to rename squad');
        }
      } catch (err) {
        console.error('Squad rename error:', err);
        FlyToast.error('Failed to rename squad');
      }
    });
  }

  // Copy Squad Invite URL
  if (copyRoomUrlBtn && shareRoomUrlInput) {
    copyRoomUrlBtn.addEventListener('click', async () => {
      const url = shareRoomUrlInput.value;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          shareRoomUrlInput.select();
          document.execCommand('copy');
        }
        FlyToast.success('Squad invite link copied to clipboard!');
      } catch (e) {
        shareRoomUrlInput.select();
        document.execCommand('copy');
        FlyToast.success('Squad invite link copied!');
      }
    });
  }

  // Native Web Share Sheet
  if (nativeShareBtn && typeof navigator.share === 'function') {
    nativeShareBtn.style.display = 'block';
    nativeShareBtn.addEventListener('click', async () => {
      try {
        const squadTitle = currentRoomData?.room?.name || 'Tardigrade Tough Squad';
        await navigator.share({
          title: `${squadTitle} — Tardigrade Tough`,
          text: `Join our squad "${squadTitle}" on Tardigrade Tough and conquer colossal nature together!`,
          url: shareRoomUrlInput ? shareRoomUrlInput.value : window.location.href,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share aborted or failed:', err);
        }
      }
    });
  }

  // Create New Group or Solo Quest
  const createNewRoomBtn = document.getElementById('createNewRoomBtn');
  if (createNewRoomBtn) {
    createNewRoomBtn.addEventListener('click', () => {
      const name = newRoomNameInput.value.trim();
      if (!name) {
        FlyToast.error('Please enter a group or solo name');
        return;
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `squad-${Date.now().toString(36)}`;
      window.location.href = `/r/${slug}`;
    });
  }

  // Join Existing
  const switchRoomBtn = document.getElementById('switchRoomBtn');
  if (switchRoomBtn) {
    switchRoomBtn.addEventListener('click', () => {
      const targetSlug = roomSlugInput.value.trim().toLowerCase();
      if (targetSlug && targetSlug !== roomSlug) {
        window.location.href = `/r/${targetSlug}`;
      }
    });
  }

  // Wishlist Modal Handling
  const wishlistModal = document.getElementById('wishlistModal');
  const wishlistCatSelect = document.getElementById('wishlistCategorySelect');
  const wishlistUnitSelect = document.getElementById('wishlistUnitSelect');
  const customCatRow = document.getElementById('wishlistCustomCategoryRow');
  const customCatInput = document.getElementById('wishlistCustomCategoryInput');
  const customUnitRow = document.getElementById('wishlistCustomUnitRow');
  const customUnitInput = document.getElementById('wishlistCustomUnitInput');

  function openWishlistModal() {
    if (wishlistModal) {
      wishlistModal.classList.remove('hidden');
      const titleInput = document.getElementById('wishlistTitleInput');
      if (titleInput) {
        titleInput.value = '';
        setTimeout(() => titleInput.focus(), 80);
      }
      const targetInput = document.getElementById('wishlistTargetInput');
      if (targetInput) targetInput.value = '';
      const notesInput = document.getElementById('wishlistNotesInput');
      if (notesInput) notesInput.value = '';
      if (customCatInput) customCatInput.value = '';
      if (customUnitInput) customUnitInput.value = '';
      if (customCatRow) customCatRow.style.display = 'none';
      if (customUnitRow) customUnitRow.style.display = 'none';
      if (wishlistCatSelect) wishlistCatSelect.value = 'weight';
      if (wishlistUnitSelect) wishlistUnitSelect.value = 'lbs';
    }
  }

  function closeWishlistModal() {
    if (wishlistModal) wishlistModal.classList.add('hidden');
  }

  if (wishlistCatSelect && wishlistUnitSelect) {
    wishlistCatSelect.addEventListener('change', () => {
      const cat = wishlistCatSelect.value;
      if (cat === 'custom') {
        if (customCatRow) customCatRow.style.display = 'block';
        if (customCatInput) setTimeout(() => customCatInput.focus(), 50);
        wishlistUnitSelect.value = 'custom_unit';
        if (customUnitRow) customUnitRow.style.display = 'block';
      } else {
        if (customCatRow) customCatRow.style.display = 'none';
        if (customUnitRow) customUnitRow.style.display = 'none';
        if (cat === 'weight') wishlistUnitSelect.value = 'lbs';
        else if (cat === 'distance') wishlistUnitSelect.value = 'mi';
        else if (cat === 'elevation') wishlistUnitSelect.value = 'ft';
      }
    });

    wishlistUnitSelect.addEventListener('change', () => {
      if (wishlistUnitSelect.value === 'custom_unit') {
        if (customUnitRow) customUnitRow.style.display = 'block';
        if (customUnitInput) setTimeout(() => customUnitInput.focus(), 50);
      } else {
        if (customUnitRow) customUnitRow.style.display = 'none';
      }
    });
  }

  if (wishlistForm) {
    wishlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('wishlistTitleInput')?.value?.trim();
      let category = wishlistCatSelect?.value || 'weight';
      let unit = wishlistUnitSelect?.value || 'lbs';
      const targetVal = parseFloat(document.getElementById('wishlistTargetInput')?.value);
      const notes = document.getElementById('wishlistNotesInput')?.value?.trim() || '';

      if (category === 'custom') {
        const customCatVal = customCatInput?.value?.trim();
        if (!customCatVal) {
          FlyToast.error('Please enter a custom category name');
          return;
        }
        category = customCatVal.toLowerCase();
      }

      if (unit === 'custom_unit') {
        const customUnitVal = customUnitInput?.value?.trim();
        if (!customUnitVal) {
          FlyToast.error('Please enter a custom unit');
          return;
        }
        unit = customUnitVal;
      }

      if (!title) {
        FlyToast.error('Please enter a quest title');
        return;
      }
      if (isNaN(targetVal) || targetVal <= 0) {
        FlyToast.error('Target value must be greater than 0');
        return;
      }

      try {
        const res = await client.post('/goals/wishlist', {
          room_slug: roomSlug,
          title,
          category,
          target_value: targetVal,
          unit,
          notes,
        });

        if (res && res.success) {
          FlyToast.success(`✨ Proposed "${title}"! View it on the Squad Wishlist in Trophy Room.`);
          closeWishlistModal();
          await loadRoomState();
        } else {
          FlyToast.error(res?.error || 'Failed to submit proposal');
        }
      } catch (err) {
        console.error('Wishlist error:', err);
        FlyToast.error('Failed to submit proposal');
      }
    });
  }

  // Document-level delegation for modal buttons & footer triggers
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openWishlistBtn') || e.target.closest('#openWishlistFromQuestsBtn')) {
      e.preventDefault();
      openWishlistModal();
      return;
    }
    if (e.target.closest('#closeWishlistBtn')) {
      e.preventDefault();
      closeWishlistModal();
      return;
    }
    if (e.target.closest('#footerAboutBtn')) {
      e.preventDefault();
      if (aboutModal) aboutModal.classList.remove('hidden');
      return;
    }
    if (e.target.closest('#footerContactBtn')) {
      e.preventDefault();
      if (aboutModal) {
        aboutModal.classList.remove('hidden');
        const contactSec = document.getElementById('aboutStorySection') || document.getElementById('aboutContactSection');
        if (contactSec) {
          setTimeout(() => {
            contactSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 80);
        }
      }
      return;
    }
    if (e.target.closest('#closeAboutBtn')) {
      e.preventDefault();
      if (aboutModal) aboutModal.classList.add('hidden');
      return;
    }
    if (e.target.closest('#footerShareBtn')) {
      e.preventDefault();
      openHub('squad');
      return;
    }
    if (e.target.closest('#closeRoomBtn')) {
      e.preventDefault();
      closeHub();
      return;
    }
    const actBtn = e.target.closest('.activate-quest-btn');
    if (actBtn) {
      e.preventDefault();
      const title = actBtn.dataset.title;
      const category = actBtn.dataset.cat;
      const targetVal = parseFloat(actBtn.dataset.val);
      const unit = actBtn.dataset.unit;
      const notes = actBtn.dataset.notes || '';

      const confirmMsg = `Promote "${title}" (${formatNumber(targetVal)} ${unit}) to an active mega-quest for this squad?`;
      if (!window.confirm(confirmMsg)) return;

      actBtn.disabled = true;
      const themeKey = category === 'weight' ? 'pando' : category === 'distance' ? 'caribou' : (category === 'elevation' ? 'everest' : 'custom');
      client.post('/goals', {
        room_slug: roomSlug,
        title,
        category,
        target_value: targetVal,
        unit,
        theme_key: themeKey,
        description: notes || title,
      }).then(res => {
        if (res && res.success) {
          FlyToast.success(`🚀 "${title}" is now an active mega-quest!`);
          loadRoomState().then(() => switchView('quests'));
        } else {
          FlyToast.error(res?.error || 'Failed to activate quest');
          actBtn.disabled = false;
        }
      }).catch(err => {
        console.error('Failed to activate quest:', err);
        FlyToast.error('Failed to activate quest');
        actBtn.disabled = false;
      });
      return;
    }
  });

  // Close modals when clicking backdrop outside modal-box
  [profileModal, roomModal, aboutModal, wishlistModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeHub();
        if (aboutModal) aboutModal.classList.add('hidden');
        if (wishlistModal) wishlistModal.classList.add('hidden');
      }
    });
  });
}

// Progressive Web App (PWA) Registration, Shortcuts & Install Prompt
function setupPwa() {
  // 1. Register Service Worker with live update reload
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('✅ Tardigrade Tough PWA Service Worker active with scope:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  FlyToast.info('Updated to latest version! Reloading...', 2000);
                  setTimeout(() => window.location.reload(), 1200);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('⚠️ PWA Service Worker registration error:', err);
        });
    });
  }

  // 2. Install Prompt Handling
  let deferredPrompt = null;
  const headerInstallBtn = document.getElementById('headerInstallBtn');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  const showInstallButtons = () => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (headerInstallBtn) headerInstallBtn.style.display = 'inline-flex';
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
  };

  const hideInstallButtons = () => {
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons();
  });

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      FlyToast.info('To install Tardigrade Tough, tap "Add to Home Screen" or the install icon in your browser address bar.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      hideInstallButtons();
    }
    deferredPrompt = null;
  };

  if (headerInstallBtn) {
    headerInstallBtn.addEventListener('click', triggerInstall);
  }
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', triggerInstall);
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButtons();
    FlyToast.success('Tardigrade Tough installed! Access it directly from your home screen.');
  });

  // 3. Handle PWA Shortcuts & URL params (?action=log, ?view=leaderboard, etc.)
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam && ['quests', 'leaderboard', 'activity', 'trophy'].includes(viewParam)) {
    const navBtn = document.getElementById(`nav${viewParam.charAt(0).toUpperCase() + viewParam.slice(1)}Btn`);
    if (navBtn) navBtn.click();
  }
  const actionParam = urlParams.get('action');
  if (actionParam === 'log') {
    const stepperInput = document.getElementById('stepperWeight');
    if (stepperInput) {
      stepperInput.focus();
      stepperInput.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

