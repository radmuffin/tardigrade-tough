import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

export const VIEW_ORDER = ['quests', 'leaderboard', 'activity', 'trophy'];
export let currentView = 'quests';

export const CANONICAL_THEME_ORDER = ['pando', 'everest', 'caribou'];

export function setupViewNavigation({ onSwitchView, onRenderQuests, onRenderTrophy } = {}) {
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

    if (target === 'trophy' && state.trophyDiorama) {
      setTimeout(() => {
        state.trophyDiorama.resize();
        if (onRenderTrophy) onRenderTrophy();
      }, 50);
    } else if (target === 'quests' && state.diorama) {
      setTimeout(() => {
        state.diorama.resize();
        if (onRenderQuests) onRenderQuests();
      }, 50);
    }

    if (onSwitchView) onSwitchView(target);
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
        // Swiped LEFT -> Next view
        if (curIdx < VIEW_ORDER.length - 1) {
          switchView(VIEW_ORDER[curIdx + 1]);
        }
      } else {
        // Swiped RIGHT -> Previous view
        if (curIdx > 0) {
          switchView(VIEW_ORDER[curIdx - 1]);
        }
      }
    }
  }, { passive: true });
}

export function cycleGoal(direction, onGoalRender) {
  if (!state.currentRoomData || !state.currentRoomData.active_goals || state.currentRoomData.active_goals.length === 0) return;
  const currentGoal = state.currentRoomData.active_goals[state.selectedGoalIndex] || state.currentRoomData.active_goals[0];
  const curTheme = currentGoal.theme_key;

  // Active themes in exact visual tab order
  const activeThemes = CANONICAL_THEME_ORDER.filter(t => 
    state.currentRoomData.active_goals.some(g => g.theme_key === t)
  );
  state.currentRoomData.active_goals.forEach(g => {
    if (!activeThemes.includes(g.theme_key)) activeThemes.push(g.theme_key);
  });

  if (activeThemes.length <= 1) return;

  let curIdx = activeThemes.indexOf(curTheme);
  if (curIdx === -1) curIdx = 0;

  let nextIdx;
  if (direction > 0) {
    nextIdx = (curIdx + 1) % activeThemes.length;
  } else {
    nextIdx = (curIdx - 1 + activeThemes.length) % activeThemes.length;
  }

  const targetTheme = activeThemes[nextIdx];
  const targetGoalIndex = state.currentRoomData.active_goals.findIndex(g => g.theme_key === targetTheme);
  if (targetGoalIndex !== -1) {
    state.selectedGoalIndex = targetGoalIndex;
    if (onGoalRender) onGoalRender();
  }
}

export function setupGoalSegmentedControl(onGoalSelect, onGoalCycle) {
  const pandoBtn = document.getElementById('goalTabPando');
  const everestBtn = document.getElementById('goalTabEverest');
  const caribouBtn = document.getElementById('goalTabCaribou');
  const prevBtn = document.getElementById('prevGoalBtn');
  const nextBtn = document.getElementById('nextGoalBtn');

  function selectGoalByTheme(theme) {
    state.pendingGoalTheme = theme;
    if (!state.currentRoomData || !state.currentRoomData.active_goals) return;
    const idx = state.currentRoomData.active_goals.findIndex(g => g.theme_key === theme);
    if (idx !== -1) {
      state.selectedGoalIndex = idx;
      if (onGoalSelect) onGoalSelect();
    }
  }

  if (pandoBtn) pandoBtn.addEventListener('click', () => selectGoalByTheme('pando'));
  if (everestBtn) everestBtn.addEventListener('click', () => selectGoalByTheme('everest'));
  if (caribouBtn) caribouBtn.addEventListener('click', () => selectGoalByTheme('caribou'));

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onGoalCycle) onGoalCycle(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onGoalCycle) onGoalCycle(1);
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
          if (onGoalCycle) onGoalCycle(1);
        } else {
          if (onGoalCycle) onGoalCycle(-1);
        }
      }
    }, { passive: true });
  }
}

export function renderGoalShowcase({ onUpdateStepper } = {}) {
  const activeGoals = state.currentRoomData?.active_goals || [];
  if (activeGoals.length === 0) return;

  if (state.pendingGoalTheme) {
    const pIdx = activeGoals.findIndex(g => g.theme_key === state.pendingGoalTheme);
    if (pIdx !== -1) {
      state.selectedGoalIndex = pIdx;
    }
    state.pendingGoalTheme = null;
  }

  if (state.selectedGoalIndex >= activeGoals.length) state.selectedGoalIndex = 0;
  const currentGoal = activeGoals[state.selectedGoalIndex];

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
          state.selectedGoalIndex = idx;
          renderGoalShowcase({ onUpdateStepper });
        });
        segControl.appendChild(btn);
      }
      const isActive = idx === state.selectedGoalIndex;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  // Update Hero Stats
  const pct = currentGoal.target_value > 0 ? (currentGoal.current_value / currentGoal.target_value) : 0;
  const pctStr = (Math.min(100, pct * 100)).toFixed(1) + '%';

  const titleEl = document.getElementById('heroGoalTitle');
  if (titleEl) titleEl.textContent = currentGoal.title;
  const pctEl = document.getElementById('heroGoalPct');
  if (pctEl) pctEl.textContent = pctStr;
  const curEl = document.getElementById('heroGoalCurrent');
  if (curEl) curEl.textContent = `${formatNumber(currentGoal.current_value)} ${currentGoal.unit}`;
  const targetEl = document.getElementById('heroGoalTarget');
  if (targetEl) targetEl.textContent = `Target: ${formatNumber(currentGoal.target_value)} ${currentGoal.unit}`;
  const descEl = document.getElementById('heroGoalDesc');
  if (descEl) descEl.textContent = currentGoal.description;

  // Update Diorama
  if (state.diorama) {
    state.diorama.setTheme(currentGoal.theme_key, pct);
  }

  // Auto-route category in Fast-Add
  const fastAddCat = document.getElementById('fastAddCategory');
  if (fastAddCat && fastAddCat.value !== currentGoal.category) {
    fastAddCat.value = currentGoal.category;
    fastAddCat.dispatchEvent(new Event('change'));
  }

  // Auto-route Stepper interface for active goal metric
  if (onUpdateStepper) {
    onUpdateStepper(currentGoal);
  }
}
