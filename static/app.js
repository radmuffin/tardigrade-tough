import { FlyToast } from '/_fly/fly-ui.js';
import { PixelDiorama } from '/canvas-art.js';
import { OfflineSyncManager } from '/offline-sync.js';

import { state } from './js/state.js';
import {
  setupViewNavigation,
  setupGoalSegmentedControl,
  cycleGoal,
  renderGoalShowcase,
} from './js/navigation.js';
import { setupLeaderboardTabs, renderLeaderboard } from './js/leaderboard.js';
import {
  setupLoggingTabs,
  setupSteppers,
  updateStepperForGoal,
  setupFastAdd,
  setupWorkoutMode,
} from './js/workouts.js';
import { setupActivityFilters, renderFeed, setupCheers } from './js/activity-feed.js';
import { renderTrophyRoom, renderWishlists } from './js/trophy.js';
import { setupModals, setupSheetImporter } from './js/modals.js';
import { initWebSocket } from './js/realtime.js';
import { setupPwa, updateOfflineStatus } from './js/pwa.js';

// 1. Initialize App on DOM Loaded
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('dioramaCanvas');
  state.diorama = new PixelDiorama(canvas);

  const trophyCanvas = document.getElementById('trophyCanvas');
  if (trophyCanvas) {
    state.trophyDiorama = new PixelDiorama(trophyCanvas);
    state.trophyDiorama.setTheme('whale', 1.0);
  }

  state.offlineSync = new OfflineSyncManager(state.client, updateOfflineStatus);

  setupViewNavigation({
    onRenderQuests: () => renderGoalShowcase({ onUpdateStepper: updateStepperForGoal }),
    onRenderTrophy: renderTrophyRoom,
  });
  setupGoalSegmentedControl(
    () => renderGoalShowcase({ onUpdateStepper: updateStepperForGoal }),
    (dir) => cycleGoal(dir, () => renderGoalShowcase({ onUpdateStepper: updateStepperForGoal }))
  );
  setupLeaderboardTabs();
  setupLoggingTabs();
  setupSteppers({ onReloadState: loadRoomState });
  setupFastAdd({ onReloadState: loadRoomState });
  setupWorkoutMode({ onReloadState: loadRoomState });
  setupCheers();
  setupModals({ onReloadState: loadRoomState });
  setupSheetImporter({ onReloadState: loadRoomState });
  setupActivityFilters({ onFilterChange: () => renderFeed({ onReloadState: loadRoomState }) });
  setupPwa();

  await loadRoomState();
  initWebSocket({ onReloadState: loadRoomState });
});

// 2. Load Room State from Backend
export async function loadRoomState() {
  try {
    const res = await state.client.get(`/room/${state.roomSlug}`);
    if (res && res.success) {
      state.currentRoomData = res.data;

      // Update and persist the actual resolved room slug
      if (res.data.room && res.data.room.slug) {
        state.roomSlug = res.data.room.slug;
        try {
          localStorage.setItem('tardigrade_current_room', state.roomSlug);
        } catch (e) {}

        // If on the root path, update URL in browser history so sharing and bookmarking works naturally
        if (window.location.pathname === '/' && state.roomSlug) {
          window.history.replaceState(null, '', `/r/${state.roomSlug}`);
        }
      }

      // Ensure active_goals are in the exact order as visual tabs: Pando -> Everest -> Caribou
      if (state.currentRoomData && state.currentRoomData.active_goals) {
        const themeOrder = ['pando', 'everest', 'caribou'];
        state.currentRoomData.active_goals.sort((a, b) => {
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

// 3. Render all UI modules from room data
export function renderAll() {
  if (!state.currentRoomData) return;

  // Header Profile & Group Chip
  const pNick = document.getElementById('profileNick');
  if (pNick) pNick.textContent = state.currentRoomData.user_profile.nickname;
  const pDot = document.getElementById('profileDot');
  if (pDot) {
    pDot.style.backgroundColor = state.currentRoomData.user_profile.avatar_color;
    if (state.currentRoomData.user_profile.avatar_emoji) {
      pDot.textContent = state.currentRoomData.user_profile.avatar_emoji;
      pDot.classList.add('has-emoji');
    } else {
      pDot.textContent = '';
      pDot.classList.remove('has-emoji');
    }
  }
  const rLabel = document.getElementById('roomNameLabel');
  if (rLabel) rLabel.textContent = state.currentRoomData.room.name;
  const pBtn = document.getElementById('profileBtn');
  if (pBtn) pBtn.title = `${state.currentRoomData.user_profile.nickname} · ${state.currentRoomData.room.name} (Settings)`;

  // Leaderboard Squad Banner
  const lbSquadName = document.getElementById('lbSquadNameLabel');
  if (lbSquadName && state.currentRoomData.room) {
    lbSquadName.textContent = state.currentRoomData.room.name;
  }
  const lbSquadCount = document.getElementById('lbSquadMembersCount');
  if (lbSquadCount) {
    const count = state.currentRoomData.members?.length || 0;
    lbSquadCount.textContent = `${count} ${count === 1 ? 'member' : 'members'}`;
  }

  // Active Goal Showcase
  renderGoalShowcase({ onUpdateStepper: updateStepperForGoal });

  // Leaderboard
  renderLeaderboard();

  // Activity Feed
  renderFeed({ onReloadState: loadRoomState });

  // Trophy Room
  renderTrophyRoom();

  // Squad Wishlists
  renderWishlists();
}
