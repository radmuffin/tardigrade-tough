import { FlyClient } from '/_fly/fly-device-sync.js';
import { FlyToast, FlyTheme } from '/_fly/fly-ui.js';
import { PixelDiorama } from './canvas-art.js';
import { OfflineSyncManager } from './offline-sync.js';

// State
let roomSlug = getRoomFromUrl() || 'main';
let client = new FlyClient({ baseUrl: '/api' });
let diorama = null;
let trophyDiorama = null;
let offlineSync = null;
let currentRoomData = null;
let selectedGoalIndex = 0;
let ws = null;
let lastLoggedSet = null;
let activityFilter = 'all';

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
  setupSteppers();
  setupFastAdd();
  setupWorkoutMode();
  setupCheers();
  setupModals();
  setupSheetImporter();
  setupActivityFilters();

  await loadRoomState();
  initWebSocket();
});

// Primary View Navigation
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
    Object.keys(navBtns).forEach(k => {
      navBtns[k].classList.toggle('active', k === target);
      views[k].style.display = k === target ? 'block' : 'none';
    });

    if (target === 'trophy' && trophyDiorama) {
      setTimeout(() => {
        trophyDiorama.resize();
        trophyDiorama.setTheme('whale', 1.0);
      }, 50);
    } else if (target === 'quests' && diorama) {
      setTimeout(() => diorama.resize(), 50);
    }
  }

  Object.keys(navBtns).forEach(k => {
    navBtns[k].addEventListener('click', () => switchView(k));
  });
}

// Goal Segmented Control & Arrow Cycling
function setupGoalSegmentedControl() {
  const pandoBtn = document.getElementById('goalTabPando');
  const everestBtn = document.getElementById('goalTabEverest');
  const caribouBtn = document.getElementById('goalTabCaribou');
  const prevBtn = document.getElementById('prevGoalBtn');
  const nextBtn = document.getElementById('nextGoalBtn');

  function selectGoalByTheme(theme) {
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

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (!currentRoomData || !currentRoomData.active_goals) return;
      const count = currentRoomData.active_goals.length;
      selectedGoalIndex = (selectedGoalIndex - 1 + count) % count;
      renderGoalShowcase();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!currentRoomData || !currentRoomData.active_goals) return;
      const count = currentRoomData.active_goals.length;
      selectedGoalIndex = (selectedGoalIndex + 1) % count;
      renderGoalShowcase();
    });
  }
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
      renderAll();
    }
  } catch (err) {
    console.warn('Failed to load room data (possibly offline):', err);
    FlyToast.info('Working offline: your logs will sync when reconnected.');
  }
}

function renderAll() {
  if (!currentRoomData) return;

  // Render Header Profile & Group Chip
  document.getElementById('profileNick').textContent = currentRoomData.user_profile.nickname;
  document.getElementById('profileDot').style.backgroundColor = currentRoomData.user_profile.avatar_color;
  document.getElementById('roomNameLabel').textContent = currentRoomData.room.name;

  // Render Active Goal Showcase
  renderGoalShowcase();

  // Render Leaderboard
  renderLeaderboard();

  // Render Live Feed
  renderFeed();
}

function renderGoalShowcase() {
  const activeGoals = currentRoomData.active_goals || [];
  if (activeGoals.length === 0) return;

  if (selectedGoalIndex >= activeGoals.length) selectedGoalIndex = 0;
  const currentGoal = activeGoals[selectedGoalIndex];

  // Highlight active segment button
  const pandoBtn = document.getElementById('goalTabPando');
  const everestBtn = document.getElementById('goalTabEverest');
  const caribouBtn = document.getElementById('goalTabCaribou');

  if (pandoBtn) pandoBtn.classList.toggle('active', currentGoal.theme_key === 'pando');
  if (everestBtn) everestBtn.classList.toggle('active', currentGoal.theme_key === 'everest');
  if (caribouBtn) caribouBtn.classList.toggle('active', currentGoal.theme_key === 'caribou');

  // Update Hero Stats
  const pct = currentGoal.target_value > 0 ? (currentGoal.current_value / currentGoal.target_value) : 0;
  const pctStr = (Math.min(100, pct * 100)).toFixed(1) + '%';

  document.getElementById('heroGoalTitle').textContent = currentGoal.title;
  document.getElementById('heroGoalPct').textContent = pctStr;
  document.getElementById('heroGoalCurrent').textContent = `${formatNumber(currentGoal.current_value)} ${currentGoal.unit}`;
  document.getElementById('heroGoalTarget').textContent = `Target: ${formatNumber(currentGoal.target_value)} ${currentGoal.unit}`;
  document.getElementById('heroGoalDesc').textContent = currentGoal.description;

  // Update Diorama
  diorama.setTheme(currentGoal.theme_key, pct);

  // Auto-route category in Fast-Add
  const fastAddCat = document.getElementById('fastAddCategory');
  if (fastAddCat) {
    fastAddCat.value = currentGoal.category;
    fastAddCat.dispatchEvent(new Event('change'));
  }
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboardList');
  container.innerHTML = '';

  let totalTonnage = 0;
  currentRoomData.leaderboard.forEach(m => totalTonnage += m.total_weight);
  document.getElementById('leaderboardTotalTonnage').textContent = `${formatNumber(totalTonnage)} lbs`;

  if (currentRoomData.leaderboard.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No workouts logged yet. Be the first to lift!</div>`;
    return;
  }

  currentRoomData.leaderboard.forEach((member, idx) => {
    const card = document.createElement('div');
    card.className = 'leaderboard-card';

    const isMe = member.user_token === currentRoomData.user_profile.user_token;
    let rankBadge = '';
    if (idx === 0) rankBadge = '🥇';
    else if (idx === 1) rankBadge = '🥈';
    else if (idx === 2) rankBadge = '🥉';

    card.innerHTML = `
      <div class="leaderboard-user">
        <div class="user-avatar" style="background-color: ${member.avatar_color}">
          ${member.nickname.substring(0, 1).toUpperCase()}
        </div>
        <div class="user-details">
          <div class="user-name-row">
            <span>${rankBadge} ${FlyToast.escape(member.nickname)} ${isMe ? '(You)' : ''}</span>
            ${member.is_daily_mvp ? '<span class="mvp-crown" title="Daily Tonnage Titan">👑</span>' : ''}
          </div>
          <span class="user-stats-sub">${member.total_sets} sets logged</span>
        </div>
      </div>
      <div class="leaderboard-score">
        <div class="score-main">${formatNumber(member.total_weight)} lbs</div>
        <div class="score-pct">${member.weight_percentage}% of Crew</div>
      </div>
    `;
    container.appendChild(card);
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
    } else {
      metricText = `+${formatNumber(act.total_metric)} ft`;
    }

    let detailStr = act.activity_type === 'weight'
      ? `${act.sets}x${act.reps} @ ${act.weight_per_rep}lbs`
      : `${act.exercise_name}`;

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

  function updateImpact() {
    const wt = parseFloat(wtInput.value) || 0;
    const reps = parseInt(repsInput.value, 10) || 0;
    const total = wt * reps;
    impactVal.textContent = `${formatNumber(total)} lbs`;
  }

  document.getElementById('wtMinusBtn').addEventListener('click', () => {
    wtInput.value = Math.max(0, (parseFloat(wtInput.value) || 0) - 10);
    updateImpact();
  });

  document.getElementById('wtPlusBtn').addEventListener('click', () => {
    wtInput.value = (parseFloat(wtInput.value) || 0) + 10;
    updateImpact();
  });

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const delta = parseFloat(chip.dataset.delta);
      if (!isNaN(delta)) {
        wtInput.value = Math.max(0, (parseFloat(wtInput.value) || 0) + delta);
        updateImpact();
      }
    });
  });

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

  document.getElementById('logSetBtn').addEventListener('click', async () => {
    const exercise = document.getElementById('stepperExercise').value;
    const weight = parseFloat(wtInput.value) || 0;
    const reps = parseInt(repsInput.value, 10) || 1;

    await executeLogActivity({
      room_slug: roomSlug,
      activity_type: 'weight',
      exercise_name: exercise,
      sets: 1,
      reps,
      weight_per_rep: weight,
    });
  });

  document.getElementById('repeatSetBtn').addEventListener('click', async () => {
    const exercise = document.getElementById('stepperExercise').value;
    const weight = parseFloat(wtInput.value) || 0;
    const reps = parseInt(repsInput.value, 10) || 1;

    await executeLogActivity({
      room_slug: roomSlug,
      activity_type: 'weight',
      exercise_name: exercise,
      sets: 1,
      reps,
      weight_per_rep: weight,
      notes: 'Repeat set',
    });
  });

  updateImpact();
}

async function executeLogActivity(req) {
  lastLoggedSet = req;

  if (navigator.onLine) {
    try {
      const res = await client.post('/activities', req);
      if (res && res.success) {
        FlyToast.success(`Logged ${formatNumber(res.data.total_metric)} ${res.data.activity_type === 'weight' ? 'lbs' : ''}!`);
        await loadRoomState();
        diorama.spawnCelebrationBurst(`+${formatNumber(res.data.total_metric)}`);
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

// 11. Modals (Profile, Room Hub, Solo Creation)
function setupModals() {
  const profileModal = document.getElementById('profileModal');
  const nickInput = document.getElementById('nickInput');
  let selectedColor = '#10b981';

  document.getElementById('profileBtn').addEventListener('click', () => {
    if (currentRoomData) {
      nickInput.value = currentRoomData.user_profile.nickname;
      selectedColor = currentRoomData.user_profile.avatar_color;
    }
    profileModal.classList.remove('hidden');
  });

  document.getElementById('closeProfileBtn').addEventListener('click', () => {
    profileModal.classList.add('hidden');
  });

  // Dark / Light Mode inside profile
  document.getElementById('themeDarkBtn').addEventListener('click', () => {
    FlyTheme.apply('dark');
    FlyToast.info('Dark mode enabled');
  });

  document.getElementById('themeLightBtn').addEventListener('click', () => {
    FlyTheme.apply('light');
    FlyToast.info('Light mode enabled');
  });

  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
    });
  });

  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const nick = nickInput.value.trim();
    try {
      const res = await client.post('/users/profile', {
        nickname: nick,
        avatar_color: selectedColor,
      });
      if (res && res.success) {
        profileModal.classList.add('hidden');
        FlyToast.success('Profile updated!');
        await loadRoomState();
      }
    } catch (e) {
      FlyToast.error('Failed to save profile');
    }
  });

  // Crew Hub & Solo Creation Modal
  const roomModal = document.getElementById('roomModal');
  const roomSlugInput = document.getElementById('roomSlugInput');
  const newRoomNameInput = document.getElementById('newRoomNameInput');
  const qrImg = document.getElementById('roomQrImage');

  document.getElementById('roomBtn').addEventListener('click', () => {
    roomSlugInput.value = roomSlug;
    const roomUrl = `${window.location.origin}/r/${roomSlug}`;
    qrImg.src = `/api/qr?url=${encodeURIComponent(roomUrl)}`;
    roomModal.classList.remove('hidden');
  });

  document.getElementById('closeRoomBtn').addEventListener('click', () => {
    roomModal.classList.add('hidden');
  });

  // Create New Group or Solo Quest
  document.getElementById('createNewRoomBtn').addEventListener('click', () => {
    const name = newRoomNameInput.value.trim();
    if (!name) {
      FlyToast.error('Please enter a group or solo name');
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `squad-${Date.now().toString(36)}`;
    window.location.href = `/r/${slug}`;
  });

  // Join Existing
  document.getElementById('switchRoomBtn').addEventListener('click', () => {
    const targetSlug = roomSlugInput.value.trim().toLowerCase();
    if (targetSlug && targetSlug !== roomSlug) {
      window.location.href = `/r/${targetSlug}`;
    }
  });
}
