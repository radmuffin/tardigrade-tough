import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

export function setupActivityFilters({ onFilterChange } = {}) {
  const allBtn = document.getElementById('filterAllCrewBtn');
  const myBtn = document.getElementById('filterMyLiftsBtn');

  if (!allBtn || !myBtn) return;

  allBtn.addEventListener('click', () => {
    state.activityFilter = 'all';
    allBtn.classList.add('active');
    myBtn.classList.remove('active');
    if (onFilterChange) onFilterChange('all');
    else renderFeed();
  });

  myBtn.addEventListener('click', () => {
    state.activityFilter = 'my';
    myBtn.classList.add('active');
    allBtn.classList.remove('active');
    if (onFilterChange) onFilterChange('my');
    else renderFeed();
  });
}

export function renderFeed({ onReloadState } = {}) {
  const container = document.getElementById('activityFeedList');
  if (!container || !state.currentRoomData) return;
  container.innerHTML = '';

  const activities = (state.currentRoomData.recent_activities || []).filter(act => {
    if (state.activityFilter === 'my') {
      return act.user_token === state.currentRoomData.user_profile?.user_token;
    }
    return true;
  });

  if (activities.length === 0) {
    const isMy = state.activityFilter === 'my';
    container.innerHTML = `
      <div class="activity-empty-state">
        <div class="activity-empty-icon">📊</div>
        <div class="activity-empty-title">No ${isMy ? 'personal' : 'crew'} activity recorded yet</div>
        <p class="activity-empty-subtitle">
          ${isMy ? 'Log a set above or import sheet data to see your history.' : 'Be the first in the squad to log a set or import past workouts!'}
        </p>
      </div>
    `;
    return;
  }

  activities.forEach(act => {
    const item = document.createElement('div');
    item.className = 'activity-item';

    const isMe = act.user_token === state.currentRoomData.user_profile?.user_token;
    let metricText = '';
    if (act.activity_type === 'weight') {
      metricText = `+${formatNumber(act.total_metric)} lbs`;
    } else if (act.activity_type === 'distance') {
      metricText = `+${act.total_metric} mi`;
    } else if (act.activity_type === 'elevation') {
      metricText = `+${formatNumber(act.total_metric)} ft`;
    } else {
      const matchGoal = (state.currentRoomData.active_goals || []).find(g => g.id === act.goal_id || g.category === act.activity_type);
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
          ${(act.user_nickname || 'L').substring(0, 1).toUpperCase()}
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
      if (delBtn) {
        delBtn.addEventListener('click', () => deleteActivity(act.id, { onReloadState }));
      }
    }

    container.appendChild(item);
  });
}

export function formatTimeAgo(isoString) {
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

export async function deleteActivity(id, { onReloadState } = {}) {
  if (!confirm('Undo / delete this activity?')) return;
  try {
    const res = await state.client.delete(`/activities/${id}`);
    if (res && res.success) {
      FlyToast.info('Activity removed.');
      if (onReloadState) await onReloadState();
    }
  } catch (err) {
    FlyToast.error('Failed to delete activity');
  }
}

export function setupCheers() {
  document.querySelectorAll('.cheer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji;
      if (state.diorama) {
        state.diorama.spawnEmojiReaction(emoji);
      }

      try {
        await state.client.post('/cheer', { room_slug: state.roomSlug, emoji });
      } catch (_) {}
    });
  });
}
